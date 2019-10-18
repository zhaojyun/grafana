import { adHocVariableInstanceReducer, AdHocVariableState } from './adHocVariableReducer';
import { ActionOf } from '../../../core/redux';
import { CreateVariable, createVariable, UpdateVariable, updateVariable } from './actions';
import { VariableType } from './types';
import { Reducer } from 'redux';

export const NEW_TEMPLATING_VARIABLE = 'NEW_TEMPLATING_VARIABLE';

export const getReducerFromType = (type: VariableType): Reducer => {
  switch (type) {
    case 'adhoc':
      return adHocVariableInstanceReducer;
    case 'query':
      return state => state;
    default:
      throw new Error(`No reducer found for type:${type}`);
  }
};

export interface TemplatingState {
  [varibleType: string]: any;
}

export const initialState: TemplatingState = {
  adhoc: {} as AdHocVariableState,
  query: {},
};

export const templatingReducer = (state: TemplatingState = initialState, action: ActionOf<any>): TemplatingState => {
  switch (action.type) {
    case createVariable.type:
      const { type } = action.payload as CreateVariable;
      const createReducer = getReducerFromType(type);
      const newCreateState = {
        ...state[type],
        [NEW_TEMPLATING_VARIABLE]: createReducer(state[type], action),
      };
      return {
        ...state,
        [type]: {
          ...newCreateState,
        },
      };
      break;
    case updateVariable.type:
      const { model } = action.payload as UpdateVariable<any>;
      if (!model.name) {
        throw new Error('Model must include name');
      }

      const updateReducer = getReducerFromType(model.type);
      const itemState = state[model.type][model.name];
      const newItemState = state[model.type][NEW_TEMPLATING_VARIABLE];
      const newState: TemplatingState = {
        ...state,
        [model.type]: {
          ...state[model.type],
          [model.name]: updateReducer(itemState || newItemState, action),
        },
      };

      if (newItemState) {
        delete newState[model.type][NEW_TEMPLATING_VARIABLE];
      }

      return newState;
      break;
    default:
      return state;
  }
};

export default {
  templating: templatingReducer,
};
