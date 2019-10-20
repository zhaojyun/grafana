import { assignModelProperties, Variable, variableTypes } from './variable';
import { AdHocVariableModel, VariableHandler } from './state/types';
import { filtersAdded } from './state/actions';
import { store } from '../../store/store';

export const adhocVariableHandler: VariableHandler<AdHocVariableModel> = {
  canHandle: variable => variable.type === 'adhoc',
  dependsOn: (variable, variableToTest) => false,
  updateOptions: (variable, searchFilter) => Promise.resolve(variable),
  getDefaults: () => ({
    id: null,
    type: 'adhoc',
    name: '',
    label: '',
    hide: 0,
    datasource: null,
    filters: [],
    skipUrlSync: false,
    initLock: null,
  }),
  getOptions: (variable, searchFilter) => Promise.resolve([]),
  getTags: (variable, searchFilter) => Promise.resolve([]),
  setValueFromUrl: (variable, urlValue) => {
    if (!Array.isArray(urlValue)) {
      urlValue = [urlValue];
    }

    const filters = urlValue.map(item => {
      const values = item.split('|').map(value => {
        return unescapeDelimiter(value);
      });
      return {
        key: values[0],
        operator: values[1],
        value: values[2],
      };
    });

    store.dispatch(filtersAdded({ id: variable.id, filters }));
    const updatedVariable = store.getState().templating.variables[variable.id];

    return Promise.resolve(updatedVariable);
  },
  setValue: (variable, option) => Promise.resolve(),
};

const unescapeDelimiter = (value: string) => {
  return value.replace(/__gfp__/g, '|');
};

export class AdhocVariable implements Variable {
  filters: any[];
  skipUrlSync: boolean;

  /** @ngInject */
  constructor(private model: any) {
    assignModelProperties(this, model, adhocVariableHandler.getDefaults());
  }

  setValue(option: any) {
    return adhocVariableHandler.setValue(null, option);
  }

  getSaveModel() {
    assignModelProperties(this.model, this, adhocVariableHandler.getDefaults());
    return this.model;
  }

  updateOptions() {
    return adhocVariableHandler.updateOptions((this as any) as AdHocVariableModel);
  }

  dependsOn(variable: any) {
    return adhocVariableHandler.dependsOn((this as any) as AdHocVariableModel, variable);
  }

  async setValueFromUrl(urlValue: string[] | string[]) {
    const updatedVariable = await adhocVariableHandler.setValueFromUrl((this as any) as AdHocVariableModel, urlValue);
    assignModelProperties(this, updatedVariable, adhocVariableHandler.getDefaults());
  }

  getValueForUrl() {
    return this.filters.map(filter => {
      return [filter.key, filter.operator, filter.value]
        .map(value => {
          return this.escapeDelimiter(value);
        })
        .join('|');
    });
  }

  escapeDelimiter(value: string) {
    return value.replace(/\|/g, '__gfp__');
  }

  setFilters(filters: any[]) {
    this.filters = filters;
  }
}

variableTypes['adhoc'] = {
  name: 'Ad hoc filters',
  ctor: AdhocVariable,
  description: 'Add key/value filters on the fly',
};
