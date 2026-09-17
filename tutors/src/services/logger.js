export function logDebug(scope, message, extra = null) {
  if (__DEV__) {
    console.log(`[DEBUG][${scope}] ${message}`, extra || '');
  }
}

export function logError(scope, error) {
  console.error(`[ERROR][${scope}]`, error?.message || error);
}
