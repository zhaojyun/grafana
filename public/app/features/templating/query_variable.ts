import _ from 'lodash';
import { DataSourceApi, MetricFindValue } from '@grafana/ui';
import { stringToJsRegex } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { assignModelProperties, containsVariable, Variable, variableTypes } from './variable';
import DatasourceSrv from '../plugins/datasource_srv';
import { default as templateSrv } from './template_srv';
import { getTimeSrv } from '../dashboard/services/TimeSrv';
import {
  QueryVariableModel,
  VariableHandler,
  VariableHide,
  VariableOption,
  VariableRefresh,
  VariableSort,
} from './state/types';
import { optionsLoaded, setOptionFromUrl, setValue, tagsLoaded, validateVariableSelectionState } from './state/actions';
import { store } from '../../store/store';
import { getVaribleFromState } from './state/reducer';

function getNoneOption(): VariableOption {
  return { text: 'None', value: '', isNone: true, selected: false };
}

export const queryVariableHandler: VariableHandler<QueryVariableModel> = {
  canHandle: variable => variable.type === 'query',
  dependsOn: (variable, variableToTest) =>
    containsVariable(variable.query, variable.datasource, variable.regex, variableToTest.name),
  updateOptions: async (variable, searchFilter) => {
    const options = await getOptions(variable, searchFilter);
    const tags = await getTags(variable, searchFilter);
    await store.dispatch(optionsLoaded({ id: variable.id, options }));
    await store.dispatch(tagsLoaded({ id: variable.id, tags }));
    await store.dispatch(validateVariableSelectionState(variable));

    return getVaribleFromState(variable) as QueryVariableModel;
  },
  getDefaults: () => ({
    id: null,
    type: 'query',
    name: '',
    label: '',
    hide: VariableHide.dontHide,
    datasource: null,
    definition: '',
    refresh: VariableRefresh.never,
    regex: '',
    query: '',
    sort: VariableSort.disabled,
    skipUrlSync: false,
    multi: false,
    includeAll: false,
    allValue: null,
    options: [],
    current: null,
    tags: [],
    useTags: false,
    tagsQuery: '',
    tagValuesQuery: '',
    initLock: null,
  }),
  setValueFromUrl: async (variable, urlValue) => {
    await store.dispatch(setOptionFromUrl(variable, urlValue));
    return Promise.resolve(getVaribleFromState(variable));
  },
  setValue: async (variable, option) => {
    await store.dispatch(setValue(variable, option));
    return Promise.resolve(getVaribleFromState(variable));
  },
  getValueForUrl: variable => {
    if (variable.current.text === 'All') {
      return 'All';
    }
    return variable.current.value;
  },
  getSaveModel: (variable, model) => {
    // copy back model properties to model
    assignModelProperties(model, variable, queryVariableHandler.getDefaults());

    // remove options
    if (variable.refresh !== VariableRefresh.never) {
      model.options = [];
    }

    return model;
  },
};

const getOptions = async (variable: QueryVariableModel, searchFilter?: string) => {
  const datasource = await getDataSourceSrv().get(variable.datasource);
  const options = await updateOptionsFromMetricFindQuery(variable, datasource, searchFilter);
  return options;
};

const getTags = async (variable: QueryVariableModel, searchFilter?: string) => {
  const datasource = await getDataSourceSrv().get(variable.datasource);
  const tags = await updateTags(variable, datasource, searchFilter);
  return tags;
};

const sortVariableValues = (options: any[], sortOrder: number) => {
  if (sortOrder === 0) {
    return options;
  }

  const sortType = Math.ceil(sortOrder / 2);
  const reverseSort = sortOrder % 2 === 0;

  if (sortType === 1) {
    options = _.sortBy(options, 'text');
  } else if (sortType === 2) {
    options = _.sortBy(options, opt => {
      const matches = opt.text.match(/.*?(\d+).*/);
      if (!matches || matches.length < 2) {
        return -1;
      } else {
        return parseInt(matches[1], 10);
      }
    });
  } else if (sortType === 3) {
    options = _.sortBy(options, opt => {
      return _.toLower(opt.text);
    });
  }

  if (reverseSort) {
    options = options.reverse();
  }

  return options;
};

export const metricNamesToVariableValues = (variable: QueryVariableModel, metricNames: any[]) => {
  let regex, i, matches;
  let options: VariableOption[] = [];

  if (variable.regex) {
    regex = stringToJsRegex(templateSrv.replace(variable.regex, {}, 'regex'));
  }
  for (i = 0; i < metricNames.length; i++) {
    const item = metricNames[i];
    let text = item.text === undefined || item.text === null ? item.value : item.text;

    let value = item.value === undefined || item.value === null ? item.text : item.value;

    if (_.isNumber(value)) {
      value = value.toString();
    }

    if (_.isNumber(text)) {
      text = text.toString();
    }

    if (regex) {
      matches = regex.exec(value);
      if (!matches) {
        continue;
      }
      if (matches.length > 1) {
        value = matches[1];
        text = matches[1];
      }
    }

    options.push({ text: text, value: value, selected: false });
  }

  options = _.uniqBy(options, 'value');
  return sortVariableValues(options, variable.sort);
};

const metricFindQuery = (
  variable: QueryVariableModel,
  datasource: DataSourceApi,
  query: string,
  searchFilter?: string
): Promise<MetricFindValue[]> => {
  const options: any = { range: undefined, variable, searchFilter };

  if (variable.refresh === VariableRefresh.onTimeRangeChanged) {
    options.range = getTimeSrv().timeRange();
  }

  return datasource.metricFindQuery(query, options);
};

const updateOptionsFromMetricFindQuery = async (
  variable: QueryVariableModel,
  datasource: DataSourceApi,
  searchFilter?: string
) => {
  const results = await metricFindQuery(variable, datasource, variable.query, searchFilter);
  const options: VariableOption[] = metricNamesToVariableValues(variable, results);
  if (variable.includeAll) {
    options.unshift({ text: 'All', value: '$__all', selected: false });
  }
  if (!options.length) {
    options.push(getNoneOption());
  }

  return options;
};

const updateTags = async (variable: QueryVariableModel, datasource: DataSourceApi, searchFilter?: string) => {
  const tags = [];
  if (variable.useTags) {
    const results = await metricFindQuery(variable, datasource, variable.tagsQuery, searchFilter);
    for (let i = 0; i < results.length; i++) {
      tags.push(results[i].text);
    }
  }

  return tags;
};

export class QueryVariable implements Variable {
  datasource: any;
  query: any;
  regex: any;
  sort: any;
  options: any;
  current: any;
  refresh: number;
  hide: number;
  name: string;
  multi: boolean;
  includeAll: boolean;
  useTags: boolean;
  tagsQuery: string;
  tagValuesQuery: string;
  tags: any[];
  skipUrlSync: boolean;
  definition: string;

  /** @ngInject */
  constructor(private model: any, private datasourceSrv: DatasourceSrv) {
    // copy model properties to this instance
    assignModelProperties(this, model, queryVariableHandler.getDefaults());
  }

  getSaveModel() {
    return queryVariableHandler.getSaveModel((this as any) as QueryVariableModel, this.model);
  }

  async setValue(option: any) {
    const updatedVariable = await queryVariableHandler.setValue((this as any) as QueryVariableModel, option);
    assignModelProperties(this, updatedVariable, queryVariableHandler.getDefaults());
    return this;
  }

  async setValueFromUrl(urlValue: any) {
    const updatedVariable = await queryVariableHandler.setValueFromUrl((this as any) as QueryVariableModel, urlValue);
    assignModelProperties(this, updatedVariable, queryVariableHandler.getDefaults());
    return this;
  }

  getValueForUrl() {
    return queryVariableHandler.getValueForUrl((this as any) as QueryVariableModel);
  }

  async updateOptions(searchFilter?: string) {
    const updatedVariable = await queryVariableHandler.updateOptions((this as any) as QueryVariableModel, searchFilter);
    assignModelProperties(this, updatedVariable, queryVariableHandler.getDefaults());
  }

  async getValuesForTag(tagKey: string) {
    const datasource = await this.datasourceSrv.get(this.datasource);
    const query = this.tagValuesQuery.replace('$tag', tagKey);
    const results = await metricFindQuery((this as any) as QueryVariableModel, datasource, query);
    return _.map(results, value => {
      return value.text;
    });
  }

  dependsOn(variable: any) {
    return queryVariableHandler.dependsOn((this as any) as QueryVariableModel, variable);
  }
}
// @ts-ignore
variableTypes['query'] = {
  name: 'Query',
  ctor: QueryVariable,
  description: 'Variable values are fetched from a datasource query',
  supportsMulti: true,
};
