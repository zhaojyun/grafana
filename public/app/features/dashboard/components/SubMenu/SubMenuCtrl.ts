import angular, { ILocationService, IScope } from 'angular';
import _ from 'lodash';
import { VariableSrv } from 'app/features/templating/all';
import { store } from '../../../../store/store';
import { variableUpdated } from 'app/features/templating/state/actions';
import { getVariablesFromState } from '../../../templating/state/reducer';

export class SubMenuCtrl {
  annotations: any;
  variables: any;
  dashboard: any;

  /** @ngInject */
  constructor(private variableSrv: VariableSrv, private $location: ILocationService, private $scope: IScope) {
    this.annotations = this.dashboard.templating.list;
    this.variables = this.variableSrv.variables;
  }

  annotationStateChanged() {
    this.dashboard.startRefresh();
  }

  async update(variable: any) {
    // tslint:disable-next-line:triple-equals copied directly from current html with != only could be a typo
    if (variable.current.value != variable.query) {
      await variable.updateOptions();
      await variableUpdated(variable);
    }
  }

  async variableUpdated(variable: any) {
    await store.dispatch(variableUpdated(variable, true));
    this.variables = getVariablesFromState();
    this.$scope.$apply();
  }

  openEditView(editview: any) {
    const search = _.extend(this.$location.search(), { editview: editview });
    this.$location.search(search);
  }
}

export function submenuDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/components/SubMenu/template.html',
    controller: SubMenuCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: '=',
    },
  };
}

angular.module('grafana.directives').directive('dashboardSubmenu', submenuDirective);
