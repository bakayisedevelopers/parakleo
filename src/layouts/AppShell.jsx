import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/app/Sidebar';
import Topbar from '../components/app/Topbar';
import TutorOfferOverlay from '../components/app/TutorOfferOverlay';
import SessionRatingPrompt from '../components/app/SessionRatingPrompt';
import AppBottomNav from '../components/app/AppBottomNav';
import { useAuth } from '../hooks/useAuth';
import useViewportMode from '../hooks/useViewportMode';
import { updateUserProfile } from '../services/userService';
import { debugError } from '../utils/devLogger';

export default function AppShell() {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const activeRole = String(user?.activeRole || user?.role || 'student').toLowerCase();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const isTutor = activeRole === 'tutor';
  const { useBottomNav } = useViewportMode();
  const isTutorRestrictedMobile = isTutor && useBottomNav;

  const isSessionRoute = useMemo(
    () => location.pathname.startsWith('/app/session/'),
    [location.pathname],
  );

  useEffect(() => {
    let cancelled = false;

    async function enforceOfflineForTutorMobile() {
      if (!isTutorRestrictedMobile || user?.onlineStatus !== 'online' || !user?.uid) return;

      try {
        const profile = await updateUserProfile(user.uid, { onlineStatus: 'offline' });
        if (!cancelled) {
          setUser((prev) => ({ ...prev, ...profile }));
        }
      } catch (error) {
        debugError('appShell', 'Failed to enforce offline mode for tutor mobile view.', {
          message: error.message,
        });
      }
    }

    enforceOfflineForTutorMobile();

    return () => {
      cancelled = true;
    };
  }, [isTutorRestrictedMobile, setUser, user?.onlineStatus, user?.uid]);

  return (
    <div
      className="min-h-screen px-3 py-3 text-zinc-100 md:px-6 md:py-6"
      style={useBottomNav ? { paddingBottom: "calc(6.5rem + env(safe-area-inset-bottom, 0px))" } : undefined}
    >
      <div className={`mx-auto grid max-w-7xl gap-4 ${isTutor ? 'md:grid-cols-[300px_1fr]' : 'lg:grid-cols-[260px_1fr]'} md:gap-6`}>
        <div className={`hidden ${isTutor ? 'md:block' : 'lg:block'} md:sticky md:top-6 md:h-[calc(100vh-3rem)] ${useBottomNav ? '!hidden' : ''}`}>
          <Sidebar role={activeRole} />
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 rounded-[2rem] bg-gradient-to-r from-emerald-500/20 via-indigo-500/10 to-cyan-500/20" />
          <div className="relative z-10">
            {activeRole === 'tutor' && !isSessionRoute && !isTutorRestrictedMobile ? <TutorOfferOverlay /> : null}
            <SessionRatingPrompt />
            <Topbar
              name={user?.fullName || user?.displayName || 'Claxi User'}
              role={activeRole}
              onOpenNav={() => setIsNavOpen(true)}
              showMenuButton={!useBottomNav}
            />
            <Outlet />
          </div>
        </div>
      </div>

      {isNavOpen ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/75 backdrop-blur-[2px]"
            aria-label="Close navigation"
            onClick={() => setIsNavOpen(false)}
          />
          <div className="absolute left-3 top-3 bottom-3 w-[85%] max-w-xs">
            <Sidebar role={activeRole} mobile onNavigate={() => setIsNavOpen(false)} />
          </div>
        </div>
      ) : null}

      {useBottomNav ? (
        <AppBottomNav role={activeRole} />
      ) : null}
    </div>
  );
}
