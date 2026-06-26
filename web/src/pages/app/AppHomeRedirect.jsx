import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getProfileStatusByRole } from '../../utils/onboarding';

export default function AppHomeRedirect() {
  const { user } = useAuth();
  const activeRole = String(user?.activeRole || user?.role || 'student').toLowerCase();
  const onboardingStatus = getProfileStatusByRole(user, activeRole);

  if (activeRole === 'admin') {
    return <Navigate to="/app/admin" replace />;
  }

  if (activeRole === 'tutor' && !onboardingStatus.complete) {
    return <Navigate to="/app/onboarding?role=tutor" replace />;
  }

  if (activeRole === 'student' && !onboardingStatus.complete) {
    return <Navigate to="/app/onboarding?role=student" replace />;
  }

  if (activeRole === 'tutor') {
    return <Navigate to="/app/tutor" replace />;
  }

  return <Navigate to="/app/student" replace />;
}
