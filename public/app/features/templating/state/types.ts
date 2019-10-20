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

export enum VariableSort {
  disabled,
  alphabeticalAsc,
  alphabeticalDesc,
  numericalAsc,
  numericalDesc,
  alphabeticalCaseInsensitiveAsc,
  alphabeticalCaseInsensitiveDesc,
}

export interface VariableOption {
  selected: boolean;
  text: string | string[];
  value: string | string[];
  isNone?: boolean;
}

export type VariableType = 'query' | 'adhoc' | 'constant' | 'datasource' | 'interval' | 'textbox' | 'custom';

export interface AdHocVariableFilter {
  key: string;
  operator: string;
  value: string;
}

export interface AdHocVariableModel extends VariableModel {
  datasource: string;
  filters: AdHocVariableFilter[];
}

export interface CustomVariableModel extends VariableWithOptions {
  allValue: string;
  includeAll: boolean;
  multi: boolean;
}

export interface DatasourceVariableModel extends VariableWithOptions {
  includeAll: boolean;
  multi: boolean;
  refresh: VariableRefresh;
  regex: string;
}

export interface IntervalVariableModel extends VariableWithOptions {
  auto: boolean;
  auto_min: string;
  auto_count: number;
  refresh: VariableRefresh;
}

export interface QueryVariableModel extends VariableWithOptions {
  allValue: string;
  datasource: string;
  definition: string;
  includeAll: boolean;
  multi: boolean;
  refresh: VariableRefresh;
  regex: string;
  sort: VariableSort;
  tags: string[];
  tagsQuery: string;
  tagValuesQuery: string;
  useTags: boolean;
}

export interface TextBoxVariableModel extends VariableWithOptions {}

export interface ConstantVariableModel extends VariableWithOptions {}

export interface VariableWithOptions extends VariableModel {
  current: VariableOption;
  options: VariableOption[];
  query: string;
}

export interface VariableModel {
  readonly id: number;
  type: VariableType;
  name: string;
  label: string;
  hide: VariableHide;
  skipUrlSync: boolean;
  initLock: Promise<any>;
}

export interface VariableHandler<T extends VariableModel = VariableModel> {
  canHandle: (variable: T) => boolean;
  dependsOn: (variable: T, variableToTest: T) => boolean;
  updateOptions: (variable: T, searchFilter?: string) => Promise<T>;
  setValueFromUrl: (variable: T, urlValue: string | string[]) => Promise<T>;
  setValue: (variable: T, option: VariableOption) => Promise<void>;
  getDefaults: () => T;
  getOptions: (variable: T, searchFilter?: string) => Promise<VariableOption[]>;
  getTags: (variable: T, searchFilter?: string) => Promise<string[]>;
}
