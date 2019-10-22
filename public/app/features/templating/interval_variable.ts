import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import { assignModelProperties, Variable, variableTypes } from './variable';
import { getTimeSrv } from '../dashboard/services/TimeSrv';
import { IntervalVariableModel, VariableHandler, VariableOption, VariableRefresh } from './state/types';
import { store } from '../../store/store';
import { optionsLoaded, setOptionFromUrl, setValue, validateVariableSelectionState } from './state/actions';
import { getVaribleFromState } from './state/reducer';
import { default as templateSrv } from './template_srv';

export const intervalVariableHandler: VariableHandler<IntervalVariableModel> = {
  canHandle: variable => variable.type === 'interval',
  dependsOn: (variable, variableToTest) => false,
  updateOptions: async (variable, searchFilter) => {
    // extract options between quotes and/or comma
    const options: VariableOption[] = _.map(variable.query.match(/(["'])(.*?)\1|\w+/g), text => {
      text = text.replace(/["']+/g, '');
      return { text: text.trim(), value: text.trim(), selected: false };
    });

    updateAutoValue(variable);

    await store.dispatch(optionsLoaded({ id: variable.id, options }));
    await store.dispatch(validateVariableSelectionState(variable));

    return getVaribleFromState(variable);
  },
  getDefaults: () => ({
    id: null,
    type: 'interval',
    name: '',
    hide: 0,
    label: '',
    refresh: VariableRefresh.onTimeRangeChanged,
    options: [],
    current: null,
    query: '1m,10m,30m,1h,6h,12h,1d,7d,14d,30d',
    auto: false,
    auto_min: '10s',
    auto_count: 30,
    skipUrlSync: false,
    initLock: null,
  }),
  setValueFromUrl: async (variable, urlValue) => {
    updateAutoValue(variable);
    await store.dispatch(setOptionFromUrl(variable, urlValue));
    return Promise.resolve(getVaribleFromState(variable));
  },
  setValue: async (variable, option) => {
    updateAutoValue(variable);
    await store.dispatch(setValue(variable, option));
    return Promise.resolve(getVaribleFromState(variable));
  },
  getValueForUrl: variable => {
    return variable.current.value;
  },
  getSaveModel: (variable, model) => {
    assignModelProperties(model, variable, intervalVariableHandler.getDefaults());
    return model;
  },
};

const updateAutoValue = (variable: IntervalVariableModel) => {
  if (!variable.auto) {
    return;
  }

  // add auto option if missing
  if (variable.options.length && variable.options[0].text !== 'auto') {
    variable.options.unshift({
      text: 'auto',
      value: '$__auto_interval_' + variable.name,
      selected: false,
    });
  }

  const res = kbn.calculateInterval(getTimeSrv().timeRange(), variable.auto_count, variable.auto_min);
  templateSrv.setGrafanaVariable('$__auto_interval_' + variable.name, res.interval);
  // for backward compatibility, to be removed eventually
  templateSrv.setGrafanaVariable('$__auto_interval', res.interval);
};

export class IntervalVariable implements Variable {
  name: string;
  auto_count: number; // tslint:disable-line variable-name
  auto_min: number; // tslint:disable-line variable-name
  options: any;
  auto: boolean;
  query: string;
  refresh: number;
  current: any;
  skipUrlSync: boolean;

  /** @ngInject */
  constructor(private model: any) {
    assignModelProperties(this, model, intervalVariableHandler.getDefaults());
    this.refresh = 2;
  }

  getSaveModel() {
    return intervalVariableHandler.getSaveModel((this as any) as IntervalVariableModel, this.model);
  }

  async setValue(option: any) {
    const updatedVariable = await intervalVariableHandler.setValue((this as any) as IntervalVariableModel, option);
    assignModelProperties(this, updatedVariable, intervalVariableHandler.getDefaults());
    return this;
  }

  async updateOptions() {
    const updatedVariable = await intervalVariableHandler.updateOptions((this as any) as IntervalVariableModel);
    assignModelProperties(this, updatedVariable, intervalVariableHandler.getDefaults());
  }

  dependsOn(variable: any) {
    return intervalVariableHandler.dependsOn((this as any) as IntervalVariableModel, variable);
  }

  async setValueFromUrl(urlValue: string | string[]) {
    const updatedVariable = await intervalVariableHandler.setValueFromUrl(
      (this as any) as IntervalVariableModel,
      urlValue
    );
    assignModelProperties(this, updatedVariable, intervalVariableHandler.getDefaults());
    return this;
  }

  getValueForUrl() {
    return intervalVariableHandler.getValueForUrl((this as any) as IntervalVariableModel);
  }
}

// @ts-ignore
variableTypes['interval'] = {
  name: 'Interval',
  ctor: IntervalVariable,
  description: 'Define a timespan interval (ex 1m, 1h, 1d)',
};
