import _ from 'lodash';
import { actionCreatorFactory } from '../../../core/redux/actionCreatorFactory';
import {
  AdHocVariableFilter,
  IntervalVariableModel,
  QueryVariableModel,
  VariableModel,
  VariableOption,
  VariableRefresh,
  VariableType,
  VariableWithOptions,
} from './types';
import { ThunkResult } from '../../../types';
import kbn from '../../../core/utils/kbn';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { TemplateSrv } from '../template_srv';
import { variableHandlers } from './reducer';

export interface CreateVariableFromModel<T extends VariableModel> {
  id: number;
  model: T;
}

export const createVariableFromModel = actionCreatorFactory<CreateVariableFromModel<any>>(
  'Core.Templating.createVariableFromModel'
).create();

export interface UpdateVariable<T extends VariableModel> extends CreateVariableFromModel<T> {}

export const updateVariable = actionCreatorFactory<UpdateVariable<any>>('Core.Templating.updateVariable').create();

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

export const setValue = (variable: VariableModel, option: VariableOption): ThunkResult<void> => {
  return async dispatch => {
    dispatch(setOptionAsCurrent({ id: variable.id, option }));
    dispatch(selectOptionsForCurrentValue({ id: variable.id }));
    if (variable.type === 'interval') {
      const templateSrv = new TemplateSrv();
      const intervalVariable = variable as IntervalVariableModel;
      // TODO: add special handling here
      if (!intervalVariable.auto) {
        return;
      }

      // add auto option if missing
      if (intervalVariable.options.length && intervalVariable.options[0].text !== 'auto') {
        intervalVariable.options.unshift({
          text: 'auto',
          value: '$__auto_interval_' + intervalVariable.name,
          selected: false,
        });
      }

      const res = kbn.calculateInterval(
        getTimeSrv().timeRange(),
        intervalVariable.auto_count,
        intervalVariable.auto_min
      );
      templateSrv.setGrafanaVariable('$__auto_interval_' + intervalVariable.name, res.interval);
      // for backward compatibility, to be removed eventually
      templateSrv.setGrafanaVariable('$__auto_interval', res.interval);
    }
  };
};

export const updateOptions = (variable: VariableWithOptions, searchFilter?: string): ThunkResult<void> => {
  return async dispatch => {
    const handler = variableHandlers.filter(handler => handler.canHandle(variable))[0];

    if (handler) {
      await handler.updateOptions(variable, searchFilter);
    }

    return Promise.resolve();
  };
};

export const processOptions = (id: number, urlValue: string | string[]): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getState().templating.variables[id] as QueryVariableModel;
    const handler = variableHandlers.filter(handler => handler.canHandle(variable))[0];
    if (!handler) {
      return;
    }

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
    const handler = variableHandlers.filter(handler => handler.canHandle(variable))[0];
    if (!handler) {
      return;
    }

    if ((variable as QueryVariableModel).refresh) {
      await handler.updateOptions(variable);
    }
    await dispatch(processOptions(variable.id, urlValue));
  };
};

export const validateVariableSelectionState = (variable: VariableWithOptions): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const handler = variableHandlers.filter(handler => handler.canHandle(variable))[0];

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

export const processVariables = (queryParams: any): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variables = getState().templating.variables;
    for (let index = 0; index < variables.length; index++) {
      const dependencies = [];
      const variable = variables[index] as QueryVariableModel;
      const handler = variableHandlers.filter(handler => handler.canHandle(variable))[0];

      if (!handler) {
        continue;
      }

      variable.initLock = new Promise(() => {});

      for (const otherVariable of variables) {
        if (handler.dependsOn(variable, otherVariable)) {
          dependencies.push(otherVariable.initLock);
        }
      }

      await Promise.all(dependencies);

      const urlValue = queryParams['var-' + variable.name];
      if (urlValue !== void 0) {
        await handler.setValueFromUrl(variable, urlValue);
        await Promise.resolve(variable.initLock);
        return;
      }

      if (
        variable.refresh === VariableRefresh.onDashboardLoad ||
        variable.refresh === VariableRefresh.onTimeRangeChanged
      ) {
        await handler.updateOptions(variable);
        await Promise.resolve(variable.initLock);
        return;
      }

      variable.initLock = Promise.resolve();
    }
  };
};
