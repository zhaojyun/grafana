import { assignModelProperties, containsVariable, Variable, variableTypes } from './variable';
import { stringToJsRegex } from '@grafana/data';
import { TemplateSrv } from './template_srv';
import { DataSourceVariableModel, VariableHandler, VariableOption, VariableRefresh } from './state/types';
import { store } from '../../store/store';
import { optionsLoaded, setOptionFromUrl, setValue, validateVariableSelectionState } from './state/actions';
import { getVaribleFromState } from './state/reducer';
import { getDataSourceSrv } from '@grafana/runtime';

export const datasourceVariableHandler: VariableHandler<DataSourceVariableModel> = {
  canHandle: variable => variable.type === 'datasource',
  dependsOn: (variable, variableToTest) => {
    if (variable.regex) {
      return containsVariable(variable.regex, variableToTest.name);
    }
    return false;
  },
  updateOptions: async (variable, searchFilter) => {
    const options: VariableOption[] = [];
    const sources = await getDataSourceSrv().getMetricSources({ skipVariables: true });
    let regex;

    if (variable.regex) {
      regex = new TemplateSrv().replace(variable.regex, null, 'regex');
      regex = stringToJsRegex(regex);
    }

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      // must match on type
      if (source.meta.id !== variable.query) {
        continue;
      }

      if (regex && !regex.exec(source.name)) {
        continue;
      }

      options.push({ text: source.name, value: source.name, selected: false });
    }

    if (options.length === 0) {
      options.push({ text: 'No data sources found', value: '', selected: false });
    }

    if (variable.includeAll) {
      options.unshift({ text: 'All', value: '$__all', selected: false });
    }

    await store.dispatch(optionsLoaded({ id: variable.id, options }));
    await store.dispatch(validateVariableSelectionState(variable));

    return getVaribleFromState(variable);
  },
  getDefaults: () => ({
    id: null,
    type: 'datasource',
    name: '',
    hide: 0,
    label: '',
    current: null,
    regex: '',
    options: [],
    query: '',
    multi: false,
    includeAll: false,
    refresh: VariableRefresh.onDashboardLoad,
    skipUrlSync: false,
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
    assignModelProperties(model, variable, datasourceVariableHandler.getDefaults());
    // don't persist options
    model.options = [];
    return model;
  },
};

export class DatasourceVariable implements Variable {
  regex: any;
  query: string;
  options: any;
  current: any;
  multi: boolean;
  includeAll: boolean;
  refresh: any;
  skipUrlSync: boolean;

  /** @ngInject */
  constructor(private model: any) {
    assignModelProperties(this, model, datasourceVariableHandler.getDefaults());
    this.refresh = 1;
  }

  getSaveModel() {
    return datasourceVariableHandler.getSaveModel((this as any) as DataSourceVariableModel, this.model);
  }

  async setValue(option: any) {
    const updatedVariable = await datasourceVariableHandler.setValue((this as any) as DataSourceVariableModel, option);
    assignModelProperties(this, updatedVariable, datasourceVariableHandler.getDefaults());
    return this;
  }

  async updateOptions() {
    const updatedVariable = await datasourceVariableHandler.updateOptions((this as any) as DataSourceVariableModel);
    assignModelProperties(this, updatedVariable, datasourceVariableHandler.getDefaults());
  }

  dependsOn(variable: any) {
    return datasourceVariableHandler.dependsOn((this as any) as DataSourceVariableModel, variable);
  }

  async setValueFromUrl(urlValue: string | string[]) {
    const updatedVariable = await datasourceVariableHandler.setValueFromUrl(
      (this as any) as DataSourceVariableModel,
      urlValue
    );
    assignModelProperties(this, updatedVariable, datasourceVariableHandler.getDefaults());
    return this;
  }

  getValueForUrl() {
    return datasourceVariableHandler.getValueForUrl((this as any) as DataSourceVariableModel);
  }
}

variableTypes['datasource'] = {
  name: 'Datasource',
  ctor: DatasourceVariable,
  supportsMulti: true,
  description: 'Enabled you to dynamically switch the datasource for multiple panels',
};
