export function assignModelProperties(target: any, source: any, defaults: any, removeKeys?: string[]) {
  for (const key in defaults) {
    if (!defaults.hasOwnProperty(key)) {
      continue;
    }

    if (removeKeys && removeKeys.indexOf(key) !== -1) {
      continue;
    }

    target[key] = source[key] === undefined ? defaults[key] : source[key];
  }
}
