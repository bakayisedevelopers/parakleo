import { usePortal } from '../hooks/usePortal';
import PortalLandingPage from './portal/PortalLandingPage';

export default function LandingPage() {
  const portal = usePortal();
  return <PortalLandingPage portalRole={portal.role} />;
}
