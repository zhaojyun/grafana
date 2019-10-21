import _ from 'lodash';
import { assignModelProperties, Variable, variableTypes } from './variable';
import { CustomVariableModel, VariableHandler, VariableOption } from './state/types';
import { store } from '../../store/store';
import { optionsLoaded, setOptionFromUrl, setValue, validateVariableSelectionState } from './state/actions';
import { getVaribleFromState } from './state/reducer';

export const customVariableHandler: VariableHandler<CustomVariableModel> = {
  canHandle: variable => variable.type === 'custom',
  dependsOn: (variable, variableToTest) => false,
  updateOptions: async (variable, searchFilter) => {
    // extract options in comma separated string (use backslash to escape wanted commas)
    const options: VariableOption[] = _.map(variable.query.match(/(?:\\,|[^,])+/g), text => {
      text = text.replace(/\\,/g, ',');
      return { text: text.trim(), value: text.trim(), selected: false };
    });

    if (variable.includeAll) {
      options.unshift({ text: 'All', value: '$__all', selected: false });
    }

    await store.dispatch(optionsLoaded({ id: variable.id, options }));
    await store.dispatch(validateVariableSelectionState(variable));

    return getVaribleFromState(variable);
  },
  getDefaults: () => ({
    id: null,
    type: 'custom',
    name: '',
    label: '',
    hide: 0,
    options: [],
    current: null,
    query: '',
    includeAll: false,
    multi: false,
    allValue: null,
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
    assignModelProperties(model, variable, customVariableHandler.getDefaults());
    return model;
  },
};

export class CustomVariable implements Variable {
  query: string;
  options: any;
  includeAll: boolean;
  multi: boolean;
  current: any;
  skipUrlSync: boolean;

  /** @ngInject */
  constructor(private model: any) {
    assignModelProperties(this, model, customVariableHandler.getDefaults());
  }

  async setValue(option: any) {
    const updatedVariable = await customVariableHandler.setValue((this as any) as CustomVariableModel, option);
    assignModelProperties(this, updatedVariable, customVariableHandler.getDefaults());
    return this;
  }

  getSaveModel() {
    return customVariableHandler.getSaveModel((this as any) as CustomVariableModel, this.model);
  }

  async updateOptions() {
    const updatedVariable = await customVariableHandler.updateOptions((this as any) as CustomVariableModel);
    assignModelProperties(this, updatedVariable, customVariableHandler.getDefaults());
  }

  dependsOn(variable: any) {
    return customVariableHandler.dependsOn((this as any) as CustomVariableModel, variable);
  }

  async setValueFromUrl(urlValue: string[]) {
    const updatedVariable = await customVariableHandler.setValueFromUrl((this as any) as CustomVariableModel, urlValue);
    assignModelProperties(this, updatedVariable, customVariableHandler.getDefaults());
    return this;
  }

  getValueForUrl() {
    return customVariableHandler.getValueForUrl((this as any) as CustomVariableModel);
  }
}

variableTypes['custom'] = {
  name: 'Custom',
  ctor: CustomVariable,
  description: 'Define variable values manually',
  supportsMulti: true,
};
