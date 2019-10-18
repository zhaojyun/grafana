import { actionCreatorFactory } from '../../../core/redux/actionCreatorFactory';
import {
  AdHocVariable,
  ConstantVariable,
  CustomVariable,
  DatasourceVariable,
  IntervalVariable,
  QueryVariable,
  TextBoxVariable,
  VariableModel,
  VariableType,
} from './types';

export interface CreateVariable {
  type: VariableType;
}

export const createVariable = actionCreatorFactory<CreateVariable>('Core.Templating.createVariable').create();

export interface UpdateVariable<T extends VariableModel> {
  model: T;
}

export const updateVariable = actionCreatorFactory<UpdateVariable<any>>(
  'Core.Templating.updateVariable'
).create();


export const updateAdHocVariable = actionCreatorFactory<UpdateVariable<AdHocVariable>>(
  'Core.Templating.updateAdHocVariable'
).create();

export const createCustomVariable = actionCreatorFactory<UpdateVariable<CustomVariable>>(
  'Core.Templating.CreateCustomVariable'
).create();

export const createDatasourceVariable = actionCreatorFactory<UpdateVariable<DatasourceVariable>>(
  'Core.Templating.CreateDatasourceVariable'
).create();

export const createIntervalVariable = actionCreatorFactory<UpdateVariable<IntervalVariable>>(
  'Core.Templating.CreateIntervalVariable'
).create();

export const createQueryVariable = actionCreatorFactory<UpdateVariable<QueryVariable>>(
  'Core.Templating.CreateQueryVariable'
).create();

export const createTextBoxVariable = actionCreatorFactory<UpdateVariable<TextBoxVariable>>(
  'Core.Templating.CreateTextBoxVariable'
).create();

export const createConstantVariable = actionCreatorFactory<UpdateVariable<ConstantVariable>>(
  'Core.Templating.CreateConstantVariable'
).create();
