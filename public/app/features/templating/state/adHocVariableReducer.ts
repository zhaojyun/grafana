import { AdHocVariable, VariableHide } from './types';
import { ActionOf, reducerFactory } from '../../../core/redux';
import { CreateVariable, createVariable, updateAdHocVariable, updateVariable, UpdateVariable } from './actions';
import { NEW_TEMPLATING_VARIABLE } from './reducer';

export interface AdHocVariableInstanceState extends AdHocVariable {}

export const initialInstanceState: AdHocVariableInstanceState = {
  type: 'adhoc',
  name: '',
  label: '',
  hide: VariableHide.dontHide,
  datasource: null,
  filters: [],
  skipUrlSync: false,
};

export const adHocVariableInstanceReducer = reducerFactory<AdHocVariableInstanceState>(initialInstanceState)
  .addMapper({
    filter: createVariable,
    mapper: (): AdHocVariableInstanceState => initialInstanceState,
  })
  .addMapper({
    filter: updateVariable,
    mapper: (state, action): AdHocVariableInstanceState => {
      const { name, label, hide, datasource, filters, skipUrlSync } = action.payload.model as AdHocVariable;
      return {
        ...state,
        name,
        label,
        hide,
        datasource,
        filters,
        skipUrlSync,
      };
    },
  })
  .create();

export interface AdHocVariableState {
  [name: string]: AdHocVariableInstanceState;
}

export const initialState: AdHocVariableState = {};

export const adHocVariableReducer = (
  state: AdHocVariableState = initialState,
  action: ActionOf<any>
): AdHocVariableState => {
  switch (action.type) {
    case createVariable.type:
      const { type } = action.payload as CreateVariable;
      if (type !== 'adhoc') {
        return state;
      }

      return {
        ...state,
        [NEW_TEMPLATING_VARIABLE]: adHocVariableInstanceReducer(undefined, action),
      };

      break;
    case updateAdHocVariable.type:
      const { model } = action.payload as UpdateVariable<AdHocVariable>;

      if (!model.name) {
        throw new Error('Model must include name');
      }

      const itemState = state[model.name];
      const newItemState = state[NEW_TEMPLATING_VARIABLE];

      if (!itemState && !newItemState) {
        // we're trying to update an item that has no name and there is no new template variable node
        throw new Error('Updating a template variable without calling create first is unsupported');
      }

      if (!newItemState) {
        return {
          ...state,
          [model.name]: adHocVariableInstanceReducer(itemState, action),
        };
      }

      const newState = {
        ...state,
        [model.name]: adHocVariableInstanceReducer(newItemState, action),
      };
      delete newState[NEW_TEMPLATING_VARIABLE];

      return newState;
      break;
    default:
      return state;
  }
};
