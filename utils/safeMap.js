// TEMPORARY DIAGNOSTIC UTILITY - DO NOT COMMIT TO PRODUCTION
// This will identify the exact .map() call crashing the app

export function safeMap(value, label, fn) {
  if (!Array.isArray(value)) {
    console.error("❌ SAFE_MAP_TRIGGERED", {
      label,
      value,
      valueType: typeof value,
      valueConstructor: value?.constructor?.name,
      isNull: value === null,
      isUndefined: value === undefined,
      stack: new Error().stack,
    });
    return [];
  }
  return value.map(fn);
}

export function safeObjectEntries(obj, label) {
  if (!obj || typeof obj !== 'object') {
    console.error("❌ SAFE_OBJECT_ENTRIES_TRIGGERED", {
      label,
      value: obj,
      type: typeof obj,
      stack: new Error().stack,
    });
    return [];
  }
  return Object.entries(obj);
}
