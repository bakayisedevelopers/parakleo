import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getPortalContext, persistPortalRole, readStoredPortalRole } from '../constants/portal';

export function usePortal() {
  const location = useLocation();

  const portal = useMemo(() => {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    return getPortalContext({
      hostname,
      pathname: location.pathname,
      storedRole: readStoredPortalRole(),
    });
  }, [location.pathname]);

  useEffect(() => {
    persistPortalRole(portal.role);
  }, [portal.role]);

  return portal;
}
