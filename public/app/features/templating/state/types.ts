import { DataSourceApi } from '@grafana/ui';

export enum VariableRefresh {
  never,
  onDashboardLoad,
  onTimeRangeChanged,
}

export enum VariableHide {
  dontHide,
  hideVariable,
  hideLabel,
}

export interface VariableOption {
  selected: boolean;
  text: string;
  value: string;
}

export interface VariableTag {
  selected: boolean;
  text: string;
  values: string[];
  valuesText: string;
}

export type VariableType = 'query' | 'adhoc' | 'constant' | 'datasource' | 'interval' | 'textbox';

export interface AdHocVariableFilter {
  key: string;
  operator: string;
  value: string;
}

export interface AdHocVariable extends VariableModel {
  datasource: DataSourceApi;
  filters: AdHocVariableFilter[];
}

export interface CustomVariable extends ConstantVariable {
  allValue: string;
  includeAll: boolean;
  multi: boolean;
}

export interface DatasourceVariable extends ConstantVariable {
  includeAll: boolean;
  multi: boolean;
  refresh: VariableRefresh;
  regex: string;
}

export interface IntervalVariable extends ConstantVariable {
  auto: boolean;
  auto_min: string;
  auto_count: number;
  refresh: VariableRefresh;
}

export interface QueryVariable extends ConstantVariable {
  allValue: string;
  datasource: DataSourceApi;
  definition: string;
  includeAll: boolean;
  multi: boolean;
  refresh: VariableRefresh;
  regex: string;
  sort: number;
  tags: VariableTag[];
  tagsQuery: string;
  tagValuesQuery: string;
  useTags: boolean;
}

export interface TextBoxVariable extends ConstantVariable {}

export interface ConstantVariable extends VariableModel {
  current: VariableModel;
  options: VariableOption[];
  query: string;
}

export interface VariableModel {
  type: VariableType;
  name: string;
  label: string;
  hide: VariableHide;
  skipUrlSync: boolean;
}
