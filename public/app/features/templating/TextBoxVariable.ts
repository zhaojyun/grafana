import { assignModelProperties, Variable, variableTypes } from './variable';
import { TextBoxVariableModel, VariableHandler, VariableHide, VariableOption } from './state/types';
import { store } from '../../store/store';
import { optionsLoaded, setOptionFromUrl, setValue, updateVariable } from './state/actions';
import { getVaribleFromState } from './state/reducer';

export const textBoxVariableHandler: VariableHandler<TextBoxVariableModel> = {
  canHandle: variable => variable.type === 'custom',
  dependsOn: (variable, variableToTest) => false,
  updateOptions: async (variable, searchFilter) => {
    const options: VariableOption[] = [{ text: variable.query.trim(), value: variable.query.trim(), selected: false }];

    await store.dispatch(optionsLoaded({ id: variable.id, options }));
    await textBoxVariableHandler.setValue(variable, options[0]);

    return getVaribleFromState(variable);
  },
  getDefaults: () => ({
    id: null,
    type: 'textbox',
    name: '',
    hide: VariableHide.dontHide,
    label: '',
    query: '',
    current: null,
    options: [],
    skipUrlSync: false,
    initLock: null,
  }),
  setValueFromUrl: async (variable, urlValue) => {
    await store.dispatch(updateVariable({ id: variable.id, model: { ...variable, query: urlValue } }));
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
    assignModelProperties(model, variable, textBoxVariableHandler.getDefaults());
    return model;
  },
};

export class TextBoxVariable implements Variable {
  query: string;
  current: any;
  options: any[];
  skipUrlSync: boolean;

  /** @ngInject */
  constructor(private model: any) {
    assignModelProperties(this, model, textBoxVariableHandler.getDefaults());
  }

  getSaveModel() {
    return textBoxVariableHandler.getSaveModel((this as any) as TextBoxVariableModel, this.model);
  }

  async setValue(option: any) {
    const updatedVariable = await textBoxVariableHandler.setValue((this as any) as TextBoxVariableModel, option);
    assignModelProperties(this, updatedVariable, textBoxVariableHandler.getDefaults());
    return this;
  }

  async updateOptions() {
    const updatedVariable = await textBoxVariableHandler.updateOptions((this as any) as TextBoxVariableModel);
    assignModelProperties(this, updatedVariable, textBoxVariableHandler.getDefaults());
    return this;
  }

  dependsOn(variable: any) {
    return textBoxVariableHandler.dependsOn((this as any) as TextBoxVariableModel, variable);
  }

  async setValueFromUrl(urlValue: string) {
    const updatedVariable = await textBoxVariableHandler.setValueFromUrl(
      (this as any) as TextBoxVariableModel,
      urlValue
    );
    assignModelProperties(this, updatedVariable, textBoxVariableHandler.getDefaults());
    return this;
  }

  getValueForUrl() {
    return textBoxVariableHandler.getValueForUrl((this as any) as TextBoxVariableModel);
  }
}
// @ts-ignore
variableTypes['textbox'] = {
  name: 'Text box',
  ctor: TextBoxVariable,
  description: 'Define a textbox variable, where users can enter any arbitrary string',
};
