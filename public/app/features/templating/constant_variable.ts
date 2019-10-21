import { assignModelProperties, Variable, variableTypes } from './variable';
import { ConstantVariableModel, VariableHandler } from './state/types';
import { store } from '../../store/store';
import { optionsLoaded, setOptionFromUrl, setValue } from './state/actions';
import { getVaribleFromState } from './state/reducer';

export const constantVariableHandler: VariableHandler<ConstantVariableModel> = {
  canHandle: variable => variable.type === 'constant',
  dependsOn: (variable, variableToTest) => false,
  updateOptions: async (variable, searchFilter) => {
    const options = [{ text: variable.query.trim(), value: variable.query.trim(), selected: false }];
    await store.dispatch(optionsLoaded({ id: variable.id, options }));
    await constantVariableHandler.setValue(variable, options[0]);
    return Promise.resolve(getVaribleFromState(variable));
  },
  getDefaults: () => ({
    id: null,
    type: 'constant',
    name: '',
    hide: 2,
    label: '',
    query: '',
    current: null,
    options: [],
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
    return variable.current.value;
  },
  getSaveModel: (variable, model) => {
    assignModelProperties(model, variable, constantVariableHandler.getDefaults());
    return model;
  },
};

export class ConstantVariable implements Variable {
  query: string;
  options: any[];
  current: any;
  skipUrlSync: boolean;

  /** @ngInject */
  constructor(private model: any) {
    assignModelProperties(this, model, constantVariableHandler.getDefaults());
  }

  getSaveModel() {
    return constantVariableHandler.getSaveModel((this as any) as ConstantVariableModel, this.model);
  }

  async setValue(option: any) {
    const updatedVariable = await constantVariableHandler.setValue((this as any) as ConstantVariableModel, option);
    assignModelProperties(this, updatedVariable, constantVariableHandler.getDefaults());
    return this;
  }

  async updateOptions() {
    const updatedVariable = await constantVariableHandler.updateOptions((this as any) as ConstantVariableModel);
    assignModelProperties(this, updatedVariable, constantVariableHandler.getDefaults());

    return Promise.resolve();
  }

  dependsOn(variable: any) {
    return constantVariableHandler.dependsOn((this as any) as ConstantVariableModel, variable);
  }

  async setValueFromUrl(urlValue: string) {
    const updatedVariable = await constantVariableHandler.setValueFromUrl(
      (this as any) as ConstantVariableModel,
      urlValue
    );
    assignModelProperties(this, updatedVariable, constantVariableHandler.getDefaults());
    return this;
  }

  getValueForUrl() {
    return constantVariableHandler.getValueForUrl((this as any) as ConstantVariableModel);
  }
}

variableTypes['constant'] = {
  name: 'Constant',
  ctor: ConstantVariable,
  description: 'Define a hidden constant variable, useful for metric prefixes in dashboards you want to share',
};
