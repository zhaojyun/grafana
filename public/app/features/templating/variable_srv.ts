// Libaries
import angular, { ILocationService, IPromise, IQService } from 'angular';
import _ from 'lodash';
// Utils & Services
import coreModule from 'app/core/core_module';
import { variableTypes } from './variable';
import { Graph } from 'app/core/utils/dag';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
// Types
import { TimeRange } from '@grafana/data';
import { store } from 'app/store/store';
import { createVariableFromModel, processVariable } from './state/actions';
import { getLastCreatedVaribleFromState, getVariablesFromState } from './state/reducer';

const logDeprecationWarning = (functionName: string) =>
  console.warn(
    `Function ${functionName} was called on VariableSrv.` +
      'VariableSrv has moved to Redux state so this will probably not work as expected'
  );

export class VariableSrv {
  dashboard: DashboardModel;
  private variables: any[];

  /** @ngInject */
  constructor(
    private $q: IQService,
    private $location: ILocationService,
    private templateSrv: TemplateSrv,
    private timeSrv: TimeSrv
  ) {
    this.createVariableFromModel = this.createVariableFromModel.bind(this);
  }

  async init(dashboard: DashboardModel) {
    logDeprecationWarning('init');
    this.dashboard = dashboard;
    // this.dashboard.events.on(CoreEvents.timeRangeUpdated, this.onTimeRangeUpdated.bind(this));
    // this.dashboard.events.on(
    //   CoreEvents.templateVariableValueUpdated,
    //   this.updateUrlParamsWithCurrentVariables.bind(this)
    // );

    // create working class models representing variables
    this.variables = dashboard.templating.list = dashboard.templating.list.map((model: any) =>
      this.createVariableFromModel(model)
    );
    this.templateSrv.init(this.variables, this.timeSrv.timeRange());

    const queryParams = this.$location.search();
    return Promise.all(this.variables.map(variable => store.dispatch(processVariable(variable, queryParams))))
      .then(() => {
        this.variables = getVariablesFromState();
        this.templateSrv.variables = getVariablesFromState();
        this.templateSrv.updateIndex();
      })
      .catch(err => console.log(err));
  }

  onTimeRangeUpdated(timeRange: TimeRange) {
    logDeprecationWarning('onTimeRangeUpdated');
    this.templateSrv.updateTimeRange(timeRange);
    const promises = this.variables
      .filter(variable => variable.refresh === 2)
      .map(variable => {
        const previousOptions = variable.options.slice();

        return variable.updateOptions().then(() => {
          if (angular.toJson(previousOptions) !== angular.toJson(variable.options)) {
            this.dashboard.templateVariableValueUpdated();
          }
        });
      });

    return this.$q.all(promises).then(() => {
      this.dashboard.startRefresh();
    });
  }

  processVariable(variable: any, queryParams: any) {
    logDeprecationWarning('processVariable');
    const dependencies = [];

    for (const otherVariable of this.variables) {
      if (variable.dependsOn(otherVariable)) {
        dependencies.push(otherVariable.initLock.promise);
      }
    }

    return this.$q
      .all(dependencies)
      .then(() => {
        const urlValue = queryParams['var-' + variable.name];
        if (urlValue !== void 0) {
          return variable.setValueFromUrl(urlValue).then(variable.initLock.resolve);
        }

        if (variable.refresh === 1 || variable.refresh === 2) {
          return variable.updateOptions().then(variable.initLock.resolve);
        }

        variable.initLock.resolve();
      })
      .finally(() => {
        this.templateSrv.variableInitialized(variable);
        delete variable.initLock;
      });
  }

  createVariableFromModel(model: any, addToState = true) {
    logDeprecationWarning('createVariableFromModel');
    // @ts-ignore
    const ctor = variableTypes[model.type].ctor;
    if (!ctor) {
      throw {
        message: 'Unable to find variable constructor for ' + model.type,
      };
    }

    if (addToState) {
      if (model.name) {
        store.dispatch(createVariableFromModel({ model }));
      }
    }

    // const variable: any = this.$injector.instantiate(ctor, { model: model });
    return getLastCreatedVaribleFromState();
  }

  addVariable(variable: any) {
    logDeprecationWarning('addVariable');
    this.variables.push(variable);
    this.templateSrv.updateIndex();
    this.dashboard.updateSubmenuVisibility();
  }

  removeVariable(variable: any) {
    logDeprecationWarning('removeVariable');
    const index = _.indexOf(this.variables, variable);
    this.variables.splice(index, 1);
    this.templateSrv.updateIndex();
    this.dashboard.updateSubmenuVisibility();
  }

  updateOptions(variable: any) {
    logDeprecationWarning('updateOptions');
    return variable.updateOptions();
  }

  variableUpdated(variable: any, emitChangeEvents?: any) {
    logDeprecationWarning('variableUpdated');
    // if there is a variable lock ignore cascading update because we are in a boot up scenario
    if (variable.initLock) {
      return this.$q.when();
    }

    const g = this.createGraph();
    const node = g.getNode(variable.name);
    let promises = [];
    if (node) {
      promises = node.getOptimizedInputEdges().map(e => {
        return this.updateOptions(this.variables.find(v => v.name === e.inputNode.name));
      });
    }

    return this.$q.all(promises).then(() => {
      if (emitChangeEvents) {
        this.dashboard.templateVariableValueUpdated();
        this.dashboard.startRefresh();
      }
    });
  }

  selectOptionsForCurrentValue(variable: any) {
    logDeprecationWarning('selectOptionsForCurrentValue');
    let i, y, value, option;
    const selected: any = [];

    for (i = 0; i < variable.options.length; i++) {
      option = variable.options[i];
      option.selected = false;
      if (_.isArray(variable.current.value)) {
        for (y = 0; y < variable.current.value.length; y++) {
          value = variable.current.value[y];
          if (option.value === value) {
            option.selected = true;
            selected.push(option);
          }
        }
      } else if (option.value === variable.current.value) {
        option.selected = true;
        selected.push(option);
      }
    }

    return selected;
  }

  validateVariableSelectionState(variable: any) {
    logDeprecationWarning('validateVariableSelectionState');
    if (!variable.current) {
      variable.current = {};
    }

    if (_.isArray(variable.current.value)) {
      let selected = this.selectOptionsForCurrentValue(variable);

      // if none pick first
      if (selected.length === 0) {
        selected = variable.options[0];
      } else {
        selected = {
          value: _.map(selected, val => {
            return val.value;
          }),
          text: _.map(selected, val => {
            return val.text;
          }),
        };
      }

      return variable.setValue(selected);
    } else {
      const currentOption: any = _.find(variable.options, {
        text: variable.current.text,
      });
      if (currentOption) {
        return variable.setValue(currentOption);
      } else {
        if (!variable.options.length) {
          return Promise.resolve();
        }
        return variable.setValue(variable.options[0]);
      }
    }
  }

  /**
   * Sets the current selected option (or options) based on the query params in the url. It is possible for values
   * in the url to not match current options of the variable. In that case the variables current value will be still set
   * to that value.
   * @param variable Instance of Variable
   * @param urlValue Value of the query parameter
   */
  setOptionFromUrl(variable: any, urlValue: string | string[]): IPromise<any> {
    logDeprecationWarning('setOptionFromUrl');
    let promise = this.$q.when();

    if (variable.refresh) {
      promise = variable.updateOptions();
    }

    return promise.then(() => {
      // Simple case. Value in url matches existing options text or value.
      let option: any = _.find(variable.options, op => {
        return op.text === urlValue || op.value === urlValue;
      });

      // No luck either it is array or value does not exist in the variables options.
      if (!option) {
        let defaultText = urlValue;
        const defaultValue = urlValue;

        if (_.isArray(urlValue)) {
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

      return variable.setValue(option);
    });
  }

  setOptionAsCurrent(variable: any, option: any) {
    logDeprecationWarning('setOptionAsCurrent');
    variable.current = _.cloneDeep(option);

    if (_.isArray(variable.current.text) && variable.current.text.length > 0) {
      variable.current.text = variable.current.text.join(' + ');
    } else if (_.isArray(variable.current.value) && variable.current.value[0] !== '$__all') {
      variable.current.text = variable.current.value.join(' + ');
    }

    this.selectOptionsForCurrentValue(variable);
    return this.variableUpdated(variable);
  }

  updateUrlParamsWithCurrentVariables() {
    logDeprecationWarning('updateUrlParamsWithCurrentVariables');
    // update url
    const params = this.$location.search();

    // remove variable params
    _.each(params, (value, key) => {
      if (key.indexOf('var-') === 0) {
        delete params[key];
      }
    });

    // add new values
    this.templateSrv.fillVariableValuesForUrl(params);
    // update url
    this.$location.search(params);
  }

  setAdhocFilter(options: any) {
    logDeprecationWarning('setAdhocFilter');
    let variable: any = _.find(this.variables, {
      type: 'adhoc',
      datasource: options.datasource,
    } as any);
    if (!variable) {
      variable = this.createVariableFromModel({
        name: 'Filters',
        type: 'adhoc',
        datasource: options.datasource,
      });
      this.addVariable(variable);
    }

    const filters = variable.filters;
    let filter: any = _.find(filters, { key: options.key, value: options.value });

    if (!filter) {
      filter = { key: options.key, value: options.value };
      filters.push(filter);
    }

    filter.operator = options.operator;
    this.variableUpdated(variable, true);
  }

  createGraph() {
    logDeprecationWarning('createGraph');
    const g = new Graph();

    this.variables.forEach(v => {
      g.createNode(v.name);
    });

    this.variables.forEach(v1 => {
      this.variables.forEach(v2 => {
        if (v1 === v2) {
          return;
        }

        if (v1.dependsOn(v2)) {
          g.link(v1.name, v2.name);
        }
      });
    });

    return g;
  }
}

coreModule.service('variableSrv', VariableSrv);
