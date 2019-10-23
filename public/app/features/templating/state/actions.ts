import _ from 'lodash';
import { actionCreatorFactory } from '../../../core/redux/actionCreatorFactory';
import {
  AdHocVariableFilter,
  AdHocVariableModel,
  QueryVariableModel,
  VariableModel,
  VariableOption,
  VariableRefresh,
  VariableType,
  VariableWithOptions,
} from './types';
import { ThunkResult } from '../../../types';
import { getVariableFromState, getVariableHandler } from './reducer';
import { Graph } from '../../../core/utils/dag';
import { DashboardModel } from '../../dashboard/state';
import { default as templateSrv } from '../template_srv';

export interface CreateVariableFromModel<T extends VariableModel> {
  model: T;
}

export const createVariableFromModel = actionCreatorFactory<CreateVariableFromModel<any>>(
  'Core.Templating.createVariableFromModel'
).create();

export interface UpdateVariable<T extends VariableModel> extends CreateVariableFromModel<T> {
  id: number;
}

export const updateVariable = actionCreatorFactory<UpdateVariable<any>>('Core.Templating.updateVariable').create();

export interface SetInitialized {
  id: number;
}

export const setInitialized = actionCreatorFactory<SetInitialized>('Core.Templating.setInitialized').create();

export interface DuplicateVariable {
  copyFromId: number;
}

export const duplicateVariable = actionCreatorFactory<DuplicateVariable>('Core.Templating.duplicateVariable').create();

export interface ChangeVariableType {
  id: number;
  changeToType: VariableType;
}

export const changeVariableType = actionCreatorFactory<ChangeVariableType>(
  'Core.Templating.changeVariableType'
).create();

export interface SetOptionAsCurrent {
  id: number;
  option: VariableOption;
}

export const setOptionAsCurrent = actionCreatorFactory<SetOptionAsCurrent>(
  'Core.Templating.setOptionAsCurrent'
).create();

export interface SelectOptionsForCurrentValue {
  id: number;
}

export const selectOptionsForCurrentValue = actionCreatorFactory<SelectOptionsForCurrentValue>(
  'Core.Templating.selectOptionsForCurrentValue'
).create();

export interface OptionsLoaded {
  id: number;
  options: VariableOption[];
}

export const optionsLoaded = actionCreatorFactory<OptionsLoaded>('Core.Templating.optionsLoaded').create();

export interface TagsLoaded {
  id: number;
  tags: string[];
}

export const tagsLoaded = actionCreatorFactory<TagsLoaded>('Core.Templating.tagsLoaded').create();

export interface FiltersAdded {
  id: number;
  filters: AdHocVariableFilter[];
}

export const filtersAdded = actionCreatorFactory<FiltersAdded>('Core.Templating.filtersAdded').create();

export const addVariable = (variable: VariableModel): ThunkResult<void> => {
  return (dispatch, getState) => {
    dispatch(createVariableFromModel({ model: variable }));
    templateSrv.updateIndex();

    const dashboard = getState().dashboard.model as DashboardModel;
    if (!dashboard) {
      return;
    }

    dashboard.updateSubmenuVisibility();
  };
};

export const duplicate = (variable: VariableModel): ThunkResult<void> => {
  return (dispatch, getState) => {
    dispatch(duplicateVariable({ copyFromId: variable.id }));
    templateSrv.updateIndex();

    const dashboard = getState().dashboard.model as DashboardModel;
    if (!dashboard) {
      return;
    }

    dashboard.updateSubmenuVisibility();
  };
};

export const setValue = (variable: VariableModel, option: VariableOption): ThunkResult<void> => {
  return async dispatch => {
    dispatch(setOptionAsCurrent({ id: variable.id, option }));
    dispatch(selectOptionsForCurrentValue({ id: variable.id }));
    dispatch(variableUpdated(variable, true));
  };
};

export const createGraph = (variables: VariableModel[]) => {
  const g = new Graph();

  variables.forEach(v => {
    g.createNode(v.name);
  });

  variables.forEach(v1 => {
    variables.forEach(v2 => {
      if (v1 === v2) {
        return;
      }

      const handler = getVariableHandler(v1.type);
      if (handler.dependsOn(v1, v2)) {
        g.link(v1.name, v2.name);
      }
    });
  });

  return g;
};

export const variableUpdated = (variable: VariableModel, emitchangeevents?: boolean): ThunkResult<void> => {
  return async (dispatch, getState) => {
    // if there is a variable lock ignore cascading update because we are in a boot up scenario
    if (!variable.initialized) {
      return;
    }

    const dashboard = getState().dashboard.model as DashboardModel;
    if (!dashboard) {
      return;
    }

    const g = createGraph(getState().templating.variables);
    const node = g.getNode(variable.name);
    let promises: Array<Promise<any>> = [];
    if (node) {
      promises = node.getOptimizedInputEdges().map(async edge => {
        const variable = getState().templating.variables.find(v => v.name === edge.inputNode.name);
        if (!variable) {
          return Promise.resolve();
        }
        const handler = getVariableHandler(variable.type);
        return handler.updateOptions(variable);
      });
    }

    return Promise.all(promises).then(() => {
      // TODO: figure out the best way to implement the rows below
      if (emitchangeevents) {
        dashboard.templateVariableValueUpdated(getState().templating.variables);
        dashboard.startRefresh(getState().templating.variables);
      }
    });
  };
};

export const updateOptions = (variable: VariableWithOptions, searchFilter?: string): ThunkResult<void> => {
  return async dispatch => {
    const handler = getVariableHandler(variable.type);
    return await handler.updateOptions(variable, searchFilter);
  };
};

export const processOptions = (id: number, urlValue: string | string[]): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getState().templating.variables[id] as QueryVariableModel;
    const handler = getVariableHandler(variable.type);

    // Simple case. Value in url matches existing options text or value.
    let option: any = _.find(variable.options, op => {
      return op.text === urlValue || op.value === urlValue;
    });

    // No luck either it is array or value does not exist in the variables options.
    if (!option) {
      let defaultText = urlValue;
      const defaultValue = urlValue;

      if (Array.isArray(urlValue)) {
        // Multiple values in the url. We construct text as a list of texts from all matched options.
        defaultText = urlValue.reduce((acc, item) => {
          const t: any = _.find(variable.options, { value: item });
          if (t) {
            acc.push(t.text);
          } else {
            acc.push(item);
          }

          return acc;
        }, []);
      }

      // It is possible that we did not match the value to any existing option. In that case the url value will be
      // used anyway for both text and value.
      option = { text: defaultText, value: defaultValue };
    }

    if (variable.multi) {
      // In case variable is multiple choice, we cast to array to preserve the same behaviour as when selecting
      // the option directly, which will return even single value in an array.
      option = { text: _.castArray(option.text), value: _.castArray(option.value) };
    }

    await handler.setValue(variable, option);
  };
};

export const setOptionFromUrl = (variable: VariableModel, urlValue: string | string[]): ThunkResult<void> => {
  return async dispatch => {
    const handler = getVariableHandler(variable.type);
    if ((variable as QueryVariableModel).refresh) {
      await handler.updateOptions(variable);
    }
    await dispatch(processOptions(variable.id, urlValue));
  };
};

export const validateVariableSelectionState = (variable: VariableWithOptions): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const handler = getVariableHandler(variable.type);

    if (!variable.current) {
      variable.current = {} as VariableOption;
    }

    if (Array.isArray(variable.current.value)) {
      const variableInState = getState().templating.variables[variable.id] as VariableWithOptions;
      const selectedOptionsInState = variableInState.options.filter(option => option.selected === true);
      let selected: VariableOption = {} as VariableOption;

      // if none pick first
      if (selectedOptionsInState.length === 0) {
        selected = variable.options[0];
      } else {
        selected = {
          value: selectedOptionsInState.map(option => option.value as string),
          text: selectedOptionsInState.map(option => option.text as string),
          selected: true,
        };
      }

      return await handler.setValue(variable, selected);
    } else {
      const currentOption: VariableOption = _.find(variable.options, {
        text: variable.current.text,
      });
      if (currentOption) {
        return await handler.setValue(variable, currentOption);
      } else {
        if (!variable.options.length) {
          return Promise.resolve(variable);
        }
        return await handler.setValue(variable, variable.options[0]);
      }
    }
  };
};

export const setAdhocFilter = (options: {
  datasource: string;
  key: string;
  value: string;
  operator: string;
}): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variables = getState().templating.variables;
    let variable = _.find(variables, {
      type: 'adhoc',
      datasource: options.datasource,
    }) as AdHocVariableModel;

    if (!variable) {
      dispatch(
        createVariableFromModel({
          model: {
            name: 'Filters',
            type: 'adhoc',
            datasource: options.datasource,
          },
        })
      );
      const id = getState().templating.lastId;
      variable = getVariableFromState({ id } as VariableModel);
    }

    const filters = variable.filters;
    let filter: AdHocVariableFilter = _.find(filters, { key: options.key, value: options.value });

    if (!filter) {
      filter = { key: options.key, value: options.value, operator: options.operator, condition: '' };
      filters.push(filter);
    }

    filter.operator = options.operator;
    dispatch(filtersAdded({ id: variable.id, filters }));
    await dispatch(variableUpdated(variable, true));
  };
};

export const processVariable = (variable: QueryVariableModel, queryParams: any): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variableInState = getVariableFromState(variable);
    if (variableInState.initialized) {
      return Promise.resolve(variableInState);
    }

    const variables = getState().templating.variables;
    const handler = getVariableHandler(variableInState.type);

    for (const otherVariable of variables) {
      if (handler.dependsOn(variableInState, otherVariable)) {
        await dispatch(processVariable(otherVariable as QueryVariableModel, queryParams));
      }
    }

    const urlValue = queryParams['var-' + variableInState.name];
    if (urlValue !== void 0) {
      await handler.setValueFromUrl(variableInState, urlValue);
      dispatch(setInitialized({ id: variableInState.id }));
      return Promise.resolve(getVariableFromState(variableInState));
    }

    if (
      variableInState.refresh === VariableRefresh.onDashboardLoad ||
      variableInState.refresh === VariableRefresh.onTimeRangeChanged
    ) {
      await handler.updateOptions(variableInState);
      dispatch(setInitialized({ id: variableInState.id }));
      return Promise.resolve(getVariableFromState(variableInState));
    }

    dispatch(setInitialized({ id: variableInState.id }));
    return Promise.resolve(getVariableFromState(variableInState));
  };
};
