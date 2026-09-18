// Deprecated: Navigation SDK has been removed in favor of external map handoff.
export const googleNavigationSdkAvailable = false;
export const GoogleNavigationProvider = ({ children }) => children;
export const useGoogleNavigationSafe = () => ({
  navigationController: {},
  removeAllListeners: () => {},
});
