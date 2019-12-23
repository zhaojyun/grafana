import { RegistryItem, Registry } from '../utils';
import { InterpolateFunction, ValueMapping } from '../types';
import toNumber from 'lodash/toNumber';

// title?: string; // The display value for this field.  This supports template variables blank is auto
// filterable?: boolean;
//
// // Numeric Options
// unit?: string;
// decimals?: number | null; // Significant digits (for display)
// min?: number | null;
// max?: number | null;

// // Convert input values into a display string
// mappings?: ValueMapping[];

// // Must be sorted by 'value', first value is always -Infinity
// thresholds?: Threshold[];

// // Used when reducing field values
// nullValueMode?: NullValueMode;

// // The behavior when clicking on a result
// links?: DataLink[];

// // Alternative to empty string
// noValue?: string;

// // Visual options
// color?: string;

/**
 * Convert the stored value to the useful value
 */
export type ConfigValueProessor<T> = (
  // The value stored in config (may be a string or an object)
  value: any,

  // The current value for this field -- an override may modify it?
  existing: T | undefined,

  // Somehow apply template variables
  // Perhaps better if just (string) => string?
  interpolate: InterpolateFunction
) => T | undefined;

const IntegerValueProcessor: ConfigValueProessor<number> = (
  value: any,
  existing: number | undefined,
  interpolate: InterpolateFunction
) => {
  // TODO: replace values in string
  return toNumber(value);
};

const FloatValueProcessor: ConfigValueProessor<number> = (
  value: any,
  existing: number | undefined,
  interpolate: InterpolateFunction
) => {
  const num = toNumber(value);
  if (isNaN(num)) {
    return undefined;
  }
  return num;
};

const StringValueProcessor: ConfigValueProessor<string> = (
  value: any,
  existing: string | undefined,
  interpolate: InterpolateFunction
) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  return value.toString();
};

const UnitProcessor: ConfigValueProessor<string> = (
  value: any,
  existing: string | undefined,
  interpolate: InterpolateFunction
) => {
  if (value === undefined || value === null || value === 'none') {
    return undefined;
  }
  return value.toString();
};

const ValueMappingProcessor: ConfigValueProessor<ValueMapping> = (
  value: any,
  existing: ValueMapping | undefined,
  interpolate: InterpolateFunction
) => {
  // TODO...
  return existing;
};

/**
 * Register the possible values
 */
export interface PropXXX<T = any> extends RegistryItem {
  processValue: ConfigValueProessor<T>;
}

export const configFields = new Registry<PropXXX>(() => {
  return [
    {
      id: 'title',
      name: 'Title',
      description: 'The displayed name',
      processValue: StringValueProcessor,
    },
    {
      id: 'decimals',
      name: 'Decimals',
      description: 'The number of decimal places to show...',
      processValue: IntegerValueProcessor,
    },
    {
      id: 'min',
      name: 'Minimum Value',
      description: 'The lowest possible value.  Used when calculating percentage (or scale)',
      processValue: FloatValueProcessor,
    },
    {
      id: 'max',
      name: 'Maximum Value',
      description: 'The higest possible value.  Used when calculating percentage (or scale)',
      processValue: FloatValueProcessor,
    },
    {
      id: 'mappings',
      name: 'Value Mappings',
      description: 'Configuire mapping result values to display values',
      processValue: ValueMappingProcessor,
    },
    {
      id: 'unit',
      name: 'Value Unit',
      description: 'The unit defines how the value gets display',
      processValue: UnitProcessor,
    },
    // ... The rest of the standard properties
  ];
});
