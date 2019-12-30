// Libraries
import React, { PureComponent } from 'react';

import {
  ThresholdsEditor,
  ValueMappingsEditor,
  PanelOptionsGrid,
  FieldDisplayEditor,
  FieldPropertiesEditor,
  PanelOptionsGroup,
  BarGaugeDisplayMode,
  FormLabel,
  Select,
  DataLinksEditor,
  Switch,
} from '@grafana/ui';
import {
  ThresholdsConfig,
  ValueMapping,
  FieldDisplayOptions,
  FieldConfig,
  DataLink,
  PanelEditorProps,
} from '@grafana/data';
import { BarGaugeOptions, displayModes } from './types';
import { orientationOptions } from '../gauge/types';
import {
  getDataLinksVariableSuggestions,
  getCalculationValueDataLinksVariableSuggestions,
} from 'app/features/panel/panellinks/link_srv';
import { config } from 'app/core/config';

export class BarGaugePanelEditor extends PureComponent<PanelEditorProps<BarGaugeOptions>> {
  onThresholdsChanged = (thresholds: ThresholdsConfig) => {
    const current = this.props.options.fieldOptions.defaults;
    this.onDefaultsChange({
      ...current,
      thresholds,
    });
  };

  onValueMappingsChanged = (mappings: ValueMapping[]) => {
    const current = this.props.options.fieldOptions.defaults;
    this.onDefaultsChange({
      ...current,
      mappings,
    });
  };

  onDisplayOptionsChanged = (fieldOptions: FieldDisplayOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      fieldOptions,
    });

  onDefaultsChange = (field: FieldConfig) => {
    this.onDisplayOptionsChanged({
      ...this.props.options.fieldOptions,
      defaults: field,
    });
  };

  onLcdCellWidthChange = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, lcdCellWidth: value });
  onOrientationChange = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, orientation: value });
  onDisplayModeChange = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, displayMode: value });
  onToggleShowUnfilled = () => {
    this.props.onOptionsChange({ ...this.props.options, showUnfilled: !this.props.options.showUnfilled });
  };

  onDataLinksChanged = (links: DataLink[]) => {
    this.onDefaultsChange({
      ...this.props.options.fieldOptions.defaults,
      links,
    });
  };
  render() {
    const { options } = this.props;
    const { fieldOptions } = options;
    const { defaults } = fieldOptions;

    const suggestions = fieldOptions.values
      ? getDataLinksVariableSuggestions(this.props.data.series)
      : getCalculationValueDataLinksVariableSuggestions(this.props.data.series);
    const labelWidth = 6;

    // lcd width
    const lcdCellWidthOptions = [6, 8, 12, 16, 24, 32].map(value => ({ value: value, label: value.toString() }));
    const lcdCellWidthDefault = { value: undefined as number, label: 'Auto' };
    lcdCellWidthOptions.unshift(lcdCellWidthDefault);

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Display">
            <FieldDisplayEditor onChange={this.onDisplayOptionsChanged} value={fieldOptions} labelWidth={labelWidth} />
            <div className="form-field">
              <FormLabel width={labelWidth}>Orientation</FormLabel>
              <Select
                width={12}
                options={orientationOptions}
                defaultValue={orientationOptions[0]}
                onChange={this.onOrientationChange}
                value={orientationOptions.find(item => item.value === options.orientation)}
              />
            </div>
            <div className="form-field">
              <FormLabel width={labelWidth}>Mode</FormLabel>
              <Select
                width={12}
                options={displayModes}
                defaultValue={displayModes[0]}
                onChange={this.onDisplayModeChange}
                value={displayModes.find(item => item.value === options.displayMode)}
              />
            </div>
            {options.displayMode !== BarGaugeDisplayMode.Lcd && (
              <Switch
                label="Unfilled"
                labelClass={`width-${labelWidth}`}
                checked={options.showUnfilled}
                onChange={this.onToggleShowUnfilled}
              />
            )}
            {options.displayMode === BarGaugeDisplayMode.Lcd && (
              <div className="form-field">
                <FormLabel width={labelWidth}>Cell size</FormLabel>
                <Select
                  width={12}
                  options={lcdCellWidthOptions}
                  defaultValue={lcdCellWidthDefault}
                  onChange={this.onLcdCellWidthChange}
                  value={lcdCellWidthOptions.find(item => item.value === options.lcdCellWidth)}
                />
              </div>
            )}
          </PanelOptionsGroup>
          <PanelOptionsGroup title="Field">
            <FieldPropertiesEditor
              showMinMax={true}
              showTitle={true}
              onChange={this.onDefaultsChange}
              value={defaults}
            />
          </PanelOptionsGroup>

          <ThresholdsEditor
            onChange={this.onThresholdsChanged}
            thresholds={defaults.thresholds}
            theme={config.theme}
            showAlphaUI={config.featureToggles.newEdit}
          />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={defaults.mappings} />

        <PanelOptionsGroup title="Data links">
          <DataLinksEditor
            value={defaults.links}
            onChange={this.onDataLinksChanged}
            suggestions={suggestions}
            maxLinks={10}
          />
        </PanelOptionsGroup>
      </>
    );
  }
}
