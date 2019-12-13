import _, { omitBy } from 'lodash';
import angular from 'angular';
import { fromFetch } from 'rxjs/fetch';
import { from, merge, NEVER, Observable, throwError } from 'rxjs';
import { delay, filter, map, mergeMap, retryWhen, tap } from 'rxjs/operators';
import { AppEvents } from '@grafana/data';
import { BackendSrv as BackendService, BackendSrvRequest, getBackendSrv as getBackendService } from '@grafana/runtime';

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardSearchHit } from 'app/types/search';
import { contextSrv, ContextSrv } from './context_srv';
import { CoreEvents, DashboardDTO, FolderInfo } from 'app/types';

export interface DatasourceRequestOptions {
  retry?: number;
  method?: string;
  requestId?: string;
  timeout?: angular.IPromise<any>;
  url?: string;
  headers?: { [key: string]: any };
  silent?: boolean;
  data?: { [key: string]: any };
}

function serializeParams(data: Record<string, any>) {
  return Object.keys(data)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
    .join('&');
}

export class BackendSrv implements BackendService {
  private inFlightRequests: { [key: string]: Array<angular.IDeferred<any>> } = {};
  private HTTP_REQUEST_CANCELED = -1;
  private noBackendCache: boolean;

  /** @ngInject */
  constructor(
    private $http: any,
    private $q: angular.IQService,
    private $timeout: angular.ITimeoutService,
    private contextSrv: ContextSrv
  ) {}

  get(url: string, params?: any) {
    return this.requestEx({ method: 'GET', url, params }).toPromise();
    //return this.request({ method: 'GET', url, params });
  }

  delete(url: string) {
    return this.requestEx({ method: 'DELETE', url }).toPromise();
    // return this.request({ method: 'DELETE', url });
  }

  post(url: string, data?: any) {
    return this.request({ method: 'POST', url, data });
  }

  patch(url: string, data: any) {
    return this.request({ method: 'PATCH', url, data });
  }

  put(url: string, data: any) {
    return this.request({ method: 'PUT', url, data });
  }

  withNoBackendCache(callback: any) {
    this.noBackendCache = true;
    return callback().finally(() => {
      this.noBackendCache = false;
    });
  }

  requestErrorHandler(err: any) {
    if (err.isHandled) {
      return;
    }

    let data = err.data || { message: 'Unexpected error' };
    if (_.isString(data)) {
      data = { message: data };
    }

    if (err.status === 422) {
      appEvents.emit(AppEvents.alertWarning, ['Validation failed', data.message]);
      throw data;
    }

    if (data.message) {
      let description = '';
      let message = data.message;
      if (message.length > 80) {
        description = message;
        message = 'Error';
      }

      appEvents.emit(err.status < 500 ? AppEvents.alertWarning : AppEvents.alertError, [message, description]);
    }

    throw data;
  }

  observableErrorHandler = (catchErrorStream: Observable<any>) => {
    const notAuthorizedStream = catchErrorStream.pipe(
      filter(error => error.status === 401 && !error.isHandled),
      map(error => {
        window.location.href = config.appSubUrl + '/logout';
        return throwError(error);
      })
    );
    const handledStream = catchErrorStream.pipe(
      delay(50),
      filter(error => error.isHandled),
      map(() => NEVER)
    );
    const unprocessableEntityStream = catchErrorStream.pipe(
      delay(50),
      filter(error => error.status === 422 && !error.isHandled),
      map(error => {
        let data = error.data || { message: 'Unexpected error' };
        if (_.isString(data)) {
          data = { message: data };
        }
        return data;
      }),
      tap(data => appEvents.emit(AppEvents.alertWarning, ['Validation failed', data.message])),
      map(data => throwError(data))
    );
    const generalErrorStream = catchErrorStream.pipe(
      delay(50),
      filter(error => error.status !== 401 && error.status !== 422 && !error.isHandled),
      map(error => {
        let data = error.data || { message: 'Unexpected error' };
        if (_.isString(data)) {
          data = { message: data };
        }
        return { data, error };
      }),
      tap(({ data, error }) => {
        if (data.message) {
          let description = '';
          let message = data.message;
          if (message.length > 80) {
            description = message;
            message = 'Error';
          }

          appEvents.emit(error.status < 500 ? AppEvents.alertWarning : AppEvents.alertError, [message, description]);
        }
      }),
      map(({ data }) => throwError(data))
    );

    return merge(notAuthorizedStream, handledStream, unprocessableEntityStream, generalErrorStream);
  };

  prepareOptions(options: BackendSrvRequest) {
    options.retry = options.retry ?? 0;
    const requestIsLocal = !options.url.match(/^http/);

    if (requestIsLocal) {
      if (contextSrv.user?.orgId) {
        options.headers = options.headers ?? {};
        options.headers['X-Grafana-Org-Id'] = contextSrv.user.orgId;
      }

      if (options.url.startsWith('/')) {
        options.url = options.url.substring(1);
      }

      if (options.url.endsWith('/')) {
        options.url = options.url.slice(0, -1);
      }
    }

    return options;
  }

  requestEx(options: BackendSrvRequest): Observable<any> {
    const preparedOptions = this.prepareOptions(options);
    const cleanParams = omitBy(preparedOptions.params, v => v === undefined || v.length === 0);
    const url = preparedOptions.params ? `${options.url}?${serializeParams(cleanParams)}` : preparedOptions.url;
    const init = {
      method: preparedOptions.method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        ...preparedOptions.headers,
      },
      body: JSON.stringify(preparedOptions.data),
    };
    const fetchStream = fromFetch(url, init);
    const successStream = fetchStream.pipe(filter(response => response.ok === true));
    const errorStream = fetchStream.pipe(filter(response => response.ok === false));
    const dataStream = successStream.pipe(
      mergeMap(response => response.json()),
      tap(response => {
        if (options.method !== 'GET' && response?.message && options.showSuccessAlert !== false) {
          appEvents.emit(AppEvents.alertSuccess, [response.message]);
        }
      })
    );
    const retryStream = errorStream.pipe(
      mergeMap(response => throwError(response)),
      retryWhen(errors =>
        errors.pipe(
          mergeMap((error, index) => {
            const firstAttempt = index === 0;
            if (error.status !== 401 || !contextSrv.user.isSignedIn || !firstAttempt) {
              return throwError(error);
            }

            return from(this.loginPing());
          })
        )
      )
    );

    return merge(dataStream, retryStream);
    //   catchError(error => {
    //     if (error.status === 401) {
    //       window.location.href = config.appSubUrl + '/logout';
    //       return throwError(error);
    //     }
    //
    //     setTimeout(error.requestErrorHandler.bind(this, error), 50);
    //     return throwError(error);
    //   })
    // );
  }

  request(options: BackendSrvRequest) {
    options.retry = options.retry || 0;
    const requestIsLocal = !options.url.match(/^http/);
    const firstAttempt = options.retry === 0;

    if (requestIsLocal) {
      if (this.contextSrv.user && this.contextSrv.user.orgId) {
        options.headers = options.headers || {};
        options.headers['X-Grafana-Org-Id'] = this.contextSrv.user.orgId;
      }

      if (options.url.indexOf('/') === 0) {
        options.url = options.url.substring(1);
      }
    }

    return this.$http(options).then(
      (results: any) => {
        if (options.method !== 'GET') {
          if (results && results.data.message) {
            if (options.showSuccessAlert !== false) {
              appEvents.emit(AppEvents.alertSuccess, [results.data.message]);
            }
          }
        }
        return results.data;
      },
      (err: any) => {
        // handle unauthorized
        if (err.status === 401 && this.contextSrv.user.isSignedIn && firstAttempt) {
          return this.loginPing()
            .then(() => {
              options.retry = 1;
              return this.request(options);
            })
            .catch((err: any) => {
              if (err.status === 401) {
                window.location.href = config.appSubUrl + '/logout';
                throw err;
              }
            });
        }

        this.$timeout(this.requestErrorHandler.bind(this, err), 50);
        throw err;
      }
    );
  }

  addCanceler(requestId: string, canceler: angular.IDeferred<any>) {
    if (requestId in this.inFlightRequests) {
      this.inFlightRequests[requestId].push(canceler);
    } else {
      this.inFlightRequests[requestId] = [canceler];
    }
  }

  resolveCancelerIfExists(requestId: string) {
    const cancelers = this.inFlightRequests[requestId];
    if (!_.isUndefined(cancelers) && cancelers.length) {
      cancelers[0].resolve();
    }
  }

  datasourceRequest(options: BackendSrvRequest) {
    let canceler: angular.IDeferred<any> = null;
    options.retry = options.retry || 0;

    // A requestID is provided by the datasource as a unique identifier for a
    // particular query. If the requestID exists, the promise it is keyed to
    // is canceled, canceling the previous datasource request if it is still
    // in-flight.
    const requestId = options.requestId;

    if (requestId) {
      this.resolveCancelerIfExists(requestId);
      // create new canceler
      canceler = this.$q.defer();
      options.timeout = canceler.promise;
      this.addCanceler(requestId, canceler);
    }

    const requestIsLocal = !options.url.match(/^http/);
    const firstAttempt = options.retry === 0;

    if (requestIsLocal) {
      if (this.contextSrv.user && this.contextSrv.user.orgId) {
        options.headers = options.headers || {};
        options.headers['X-Grafana-Org-Id'] = this.contextSrv.user.orgId;
      }

      if (options.url.indexOf('/') === 0) {
        options.url = options.url.substring(1);
      }

      if (options.headers && options.headers.Authorization) {
        options.headers['X-DS-Authorization'] = options.headers.Authorization;
        delete options.headers.Authorization;
      }

      if (this.noBackendCache) {
        options.headers['X-Grafana-NoCache'] = 'true';
      }
    }

    return this.$http(options)
      .then((response: any) => {
        if (!options.silent) {
          appEvents.emit(CoreEvents.dsRequestResponse, response);
        }
        return response;
      })
      .catch((err: any) => {
        if (err.status === this.HTTP_REQUEST_CANCELED) {
          throw { err, cancelled: true };
        }

        // handle unauthorized for backend requests
        if (requestIsLocal && firstAttempt && err.status === 401) {
          return this.loginPing()
            .then(() => {
              options.retry = 1;
              if (canceler) {
                canceler.resolve();
              }
              return this.datasourceRequest(options);
            })
            .catch((err: any) => {
              if (err.status === 401) {
                window.location.href = config.appSubUrl + '/logout';
                throw err;
              }
            });
        }

        // populate error obj on Internal Error
        if (_.isString(err.data) && err.status === 500) {
          err.data = {
            error: err.statusText,
            response: err.data,
          };
        }

        // for Prometheus
        if (err.data && !err.data.message && _.isString(err.data.error)) {
          err.data.message = err.data.error;
        }
        if (!options.silent) {
          appEvents.emit(CoreEvents.dsRequestError, err);
        }
        throw err;
      })
      .finally(() => {
        // clean up
        if (options.requestId) {
          this.inFlightRequests[options.requestId].shift();
        }
      });
  }

  loginPing() {
    return this.request({ url: '/api/login/ping', method: 'GET', retry: 1 });
  }

  search(query: any): Promise<DashboardSearchHit[]> {
    return this.get('/api/search', query);
  }

  getDashboardBySlug(slug: string) {
    return this.get(`/api/dashboards/db/${slug}`);
  }

  getDashboardByUid(uid: string) {
    return this.get(`/api/dashboards/uid/${uid}`);
  }

  getFolderByUid(uid: string) {
    return this.get(`/api/folders/${uid}`);
  }

  saveDashboard(
    dash: DashboardModel,
    { message = '', folderId, overwrite = false }: { message?: string; folderId?: number; overwrite?: boolean } = {}
  ) {
    return this.post('/api/dashboards/db/', {
      dashboard: dash,
      folderId,
      overwrite,
      message,
    });
  }

  createFolder(payload: any) {
    return this.post('/api/folders', payload);
  }

  deleteFolder(uid: string, showSuccessAlert: boolean) {
    return this.requestEx({
      method: 'DELETE',
      url: `/api/folders/${uid}`,
      showSuccessAlert: showSuccessAlert === true,
    }).toPromise();
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean) {
    return this.requestEx({
      method: 'DELETE',
      url: `/api/dashboards/uid/${uid}`,
      showSuccessAlert: showSuccessAlert === true,
    }).toPromise();
  }

  deleteFoldersAndDashboards(folderUids: string[], dashboardUids: string[]) {
    const tasks = [];

    for (const folderUid of folderUids) {
      tasks.push(this.createTask(this.deleteFolder.bind(this), true, folderUid, true));
    }

    for (const dashboardUid of dashboardUids) {
      tasks.push(this.createTask(this.deleteDashboard.bind(this), true, dashboardUid, true));
    }

    return this.executeInOrder(tasks, []);
  }

  moveDashboards(dashboardUids: string[], toFolder: FolderInfo) {
    const tasks = [];

    for (const uid of dashboardUids) {
      tasks.push(this.createTask(this.moveDashboard.bind(this), true, uid, toFolder));
    }

    return this.executeInOrder(tasks, []).then((result: any) => {
      return {
        totalCount: result.length,
        successCount: _.filter(result, { succeeded: true }).length,
        alreadyInFolderCount: _.filter(result, { alreadyInFolder: true }).length,
      };
    });
  }

  private moveDashboard(uid: string, toFolder: FolderInfo) {
    const deferred = this.$q.defer();

    this.getDashboardByUid(uid).then((fullDash: DashboardDTO) => {
      const model = new DashboardModel(fullDash.dashboard, fullDash.meta);

      if ((!fullDash.meta.folderId && toFolder.id === 0) || fullDash.meta.folderId === toFolder.id) {
        deferred.resolve({ alreadyInFolder: true });
        return;
      }

      const clone = model.getSaveModelClone();
      const options = {
        folderId: toFolder.id,
        overwrite: false,
      };

      this.saveDashboard(clone, options)
        .then(() => {
          deferred.resolve({ succeeded: true });
        })
        .catch((err: any) => {
          if (err.data && err.data.status === 'plugin-dashboard') {
            err.isHandled = true;
            options.overwrite = true;

            this.saveDashboard(clone, options)
              .then(() => {
                deferred.resolve({ succeeded: true });
              })
              .catch((err: any) => {
                deferred.resolve({ succeeded: false });
              });
          } else {
            deferred.resolve({ succeeded: false });
          }
        });
    });

    return deferred.promise;
  }

  private createTask(fn: Function, ignoreRejections: boolean, ...args: any[]) {
    return (result: any) => {
      return fn
        .apply(null, args)
        .then((res: any) => {
          return Array.prototype.concat(result, [res]);
        })
        .catch((err: any) => {
          if (ignoreRejections) {
            return result;
          }

          throw err;
        });
    };
  }

  private executeInOrder(tasks: any[], initialValue: any[]) {
    return tasks.reduce(this.$q.when, initialValue);
  }
}

coreModule.service('backendSrv', BackendSrv);

// Used for testing and things that really need BackendSrv
export function getBackendSrv(): BackendSrv {
  return getBackendService() as BackendSrv;
}
