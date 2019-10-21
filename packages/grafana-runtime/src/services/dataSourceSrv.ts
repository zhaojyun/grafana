import { ScopedVars } from '@grafana/data';
import { DataSourceApi, DataSourceSelectItem } from '@grafana/ui';

export interface DataSourceSrv {
  get(name?: string, scopedVars?: ScopedVars): Promise<DataSourceApi>;
  getMetricSources(options?: { skipVariables?: boolean }): DataSourceSelectItem[];
}

let singletonInstance: DataSourceSrv;

export function setDataSourceSrv(instance: DataSourceSrv) {
  singletonInstance = instance;
}

export function getDataSourceSrv(): DataSourceSrv {
  return singletonInstance;
}
