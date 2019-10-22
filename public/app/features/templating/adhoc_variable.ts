import { assignModelProperties, Variable, variableTypes } from './variable';
import { AdHocVariableModel, VariableHandler } from './state/types';
import { filtersAdded } from './state/actions';
import { store } from '../../store/store';
import { getVaribleFromState } from './state/reducer';

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
        condition: '',
      };
    });

    store.dispatch(filtersAdded({ id: variable.id, filters }));
    const updatedVariable = getVaribleFromState(variable);

    return Promise.resolve(updatedVariable);
  },
  setValue: (variable, option) => Promise.resolve(variable),
  getValueForUrl: variable => {
    return variable.filters.map(filter => {
      return [filter.key, filter.operator, filter.value]
        .map(value => {
          return escapeDelimiter(value);
        })
        .join('|');
    });
  },
  getSaveModel: (variable, model) => {
    assignModelProperties(model, variable, adhocVariableHandler.getDefaults(), ['id', 'initLock']);
    return model;
  },
  setFilters: (variable, filters) => {
    store.dispatch(filtersAdded({ id: variable.id, filters }));
    return getVaribleFromState(variable);
  },
};

const unescapeDelimiter = (value: string) => {
  return value.replace(/__gfp__/g, '|');
};

const escapeDelimiter = (value: string) => {
  return value.replace(/\|/g, '__gfp__');
};

export class AdhocVariable implements Variable {
  filters: any[];
  skipUrlSync: boolean;

  /** @ngInject */
  constructor(private model: any) {
    assignModelProperties(this, model, adhocVariableHandler.getDefaults());
  }

  async setValue(option: any) {
    const updatedVariable = await adhocVariableHandler.setValue((this as any) as AdHocVariableModel, option);
    assignModelProperties(this, updatedVariable, adhocVariableHandler.getDefaults());
    return this;
  }

  getSaveModel() {
    return adhocVariableHandler.getSaveModel((this as any) as AdHocVariableModel, this.model);
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
    return this;
  }

  getValueForUrl() {
    return adhocVariableHandler.getValueForUrl((this as any) as AdHocVariableModel);
  }

  setFilters(filters: any[]) {
    const updatedVariable = adhocVariableHandler.setFilters((this as any) as AdHocVariableModel, filters);
    assignModelProperties(this, updatedVariable, adhocVariableHandler.getDefaults());
  }
}

variableTypes['adhoc'] = {
  name: 'Ad hoc filters',
  ctor: AdhocVariable,
  description: 'Add key/value filters on the fly',
};
