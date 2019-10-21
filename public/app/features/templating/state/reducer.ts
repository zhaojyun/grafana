import { reducerFactory } from '../../../core/redux';
import {
  changeVariableType,
  createVariableFromModel,
  duplicateVariable,
  filtersAdded,
  optionsLoaded,
  selectOptionsForCurrentValue,
  setOptionAsCurrent,
  tagsLoaded,
  updateVariable,
} from './actions';
import { VariableHandler, VariableModel, VariableOption, VariableWithOptions } from './types';
import { adhocVariableHandler } from '../adhoc_variable';
import { queryVariableHandler } from '../query_variable';
import { store } from '../../../store/store';
import { constantVariableHandler } from '../constant_variable';
import { customVariableHandler } from '../custom_variable';

export const getVaribleFromState = <T extends VariableModel = VariableModel>(variable: T) =>
  store.getState().templating.variables[variable.id];

export const variableHandlers: VariableHandler[] = [
  adhocVariableHandler,
  queryVariableHandler,
  constantVariableHandler,
  customVariableHandler,
];

export interface TemplatingState {
  variables: VariableModel[];
}

export const initialState: TemplatingState = {
  variables: [],
};

export const templatingReducer = reducerFactory<TemplatingState>(initialState)
  .addMapper({
    filter: createVariableFromModel,
    mapper: (state, action) => {
      const { id, model } = action.payload;
      const handler = variableHandlers.filter(handler => handler.canHandle(model))[0];
      if (!handler) {
        return state;
      }

      const defaults = { ...handler.getDefaults(), ...model, id };

      if (id === state.variables.length) {
        return {
          ...state,
          variables: [...state.variables, defaults],
        };
      }

      const variables = state.variables.map((item, index) => {
        if (index !== id) {
          return item;
        }

        return {
          ...item,
          ...defaults,
        };
      });

      return {
        ...state,
        variables,
      };
    },
  })
  .addMapper({
    filter: updateVariable,
    mapper: (state, action) => {
      const { id, model } = action.payload;
      const variables = state.variables.map((item, index) => {
        if (index !== id) {
          return item;
        }

        return {
          ...item,
          ...model,
        };
      });

      return {
        ...state,
        variables,
      };
    },
  })
  .addMapper({
    filter: changeVariableType,
    mapper: (state, action) => {
      const { id, changeToType } = action.payload;
      const handler = variableHandlers.filter(handler => handler.canHandle({ type: changeToType } as VariableModel))[0];
      if (!handler) {
        return state;
      }

      const defaults = { ...handler.getDefaults(), id };

      if (id === state.variables.length) {
        return {
          ...state,
          variables: [...state.variables, defaults],
        };
      }

      const variables = state.variables.map((item, index) => {
        if (index !== id) {
          return item;
        }

        return {
          ...defaults,
          id: item.id,
          name: item.name,
          label: item.label,
        };
      });

      return {
        ...state,
        variables,
      };
    },
  })
  .addMapper({
    filter: duplicateVariable,
    mapper: (state, action) => {
      const { copyFromId } = action.payload;
      const copy = { ...state.variables[copyFromId] };
      copy.id = state.variables.length;
      copy.name = `copy_of_${copy.name}`;

      return {
        ...state,
        variables: [...state.variables, copy],
      };
    },
  })
  .addMapper({
    filter: setOptionAsCurrent,
    mapper: (state, action) => {
      const { id, option } = action.payload;

      const variables = state.variables.map((item, index) => {
        if (index !== id) {
          return item;
        }

        const current = { ...option };

        if (Array.isArray(current.text) && current.text.length > 0) {
          current.text = current.text.join(' + ');
        } else if (Array.isArray(current.value) && current.value[0] !== '$__all') {
          current.text = current.value.join(' + ');
        }

        return {
          ...item,
          current,
        };
      });

      return {
        ...state,
        variables,
      };
    },
  })
  .addMapper({
    filter: selectOptionsForCurrentValue,
    mapper: (state, action) => {
      const { id } = action.payload;

      const variables = state.variables.map((item, index) => {
        if (index !== id) {
          return item;
        }

        const itemWithOptions = (item as any) as VariableWithOptions;
        const currentValue = itemWithOptions.current.value;
        const options: VariableOption[] = itemWithOptions.options.map(option => {
          const retVal = {
            ...option,
            selected: false,
          };

          if (Array.isArray(currentValue)) {
            for (let y = 0; y < currentValue.length; y++) {
              const value = currentValue[y];
              if (option.value === value) {
                retVal.selected = true;
              }
            }
          } else if (option.value === currentValue) {
            retVal.selected = true;
          }

          return retVal;
        });

        return {
          ...item,
          options,
        };
      });

      return {
        ...state,
        variables,
      };
    },
  })
  .addMapper({
    filter: optionsLoaded,
    mapper: (state, action) => {
      const { id, options } = action.payload;

      const variables = state.variables.map((item, index) => {
        if (index !== id) {
          return item;
        }

        return {
          ...item,
          options,
        };
      });

      return {
        ...state,
        variables,
      };
    },
  })
  .addMapper({
    filter: tagsLoaded,
    mapper: (state, action) => {
      const { id, tags } = action.payload;

      const variables = state.variables.map((item, index) => {
        if (index !== id) {
          return item;
        }

        return {
          ...item,
          tags,
        };
      });

      return {
        ...state,
        variables,
      };
    },
  })
  .addMapper({
    filter: filtersAdded,
    mapper: (state, action) => {
      const { id, filters } = action.payload;

      const variables = state.variables.map((item, index) => {
        if (index !== id) {
          return item;
        }

        return {
          ...item,
          filters,
        };
      });

      return {
        ...state,
        variables,
      };
    },
  })
  .create();

export default {
  templating: templatingReducer,
};
