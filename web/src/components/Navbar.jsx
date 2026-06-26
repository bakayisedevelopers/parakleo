import { Link } from 'react-router-dom';
import Button from './Button';
import { useAuth } from '../hooks/useAuth';
import { getPortalRoutes, normalizePortalRole } from '../constants/portal';
import { usePortal } from '../hooks/usePortal';

export default function Navbar() {
  const { isAuthenticated, isInitializing } = useAuth();
  const portal = usePortal();
  const role = normalizePortalRole(portal.role);
  const routes = getPortalRoutes(role);
  const brandLabel = role === 'student'
    ? 'Parakleo'
    : role === 'admin'
      ? 'Parakleo Admin'
      : 'Parakleo Tutors';
  const showLandingLinks = role !== 'admin';

  const linkClassName = 'rounded-full px-3 py-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-brand/10 hover:text-brand-dark';

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to={routes.landingPath} className="flex items-center gap-2 group">
            <img
              src="/logo.png"
              alt={`${brandLabel} logo`}
              className="h-10 w-10 rounded-xl object-cover transition-transform group-hover:scale-[1.02]"
            />
            <span className="bg-gradient-to-r from-brand via-emerald-500 to-brand-dark bg-clip-text text-xl font-black text-transparent">
              {brandLabel}
            </span>
          </Link>

          {/* Navigation Links */}
          {showLandingLinks ? (
            <div className="hidden md:flex items-center gap-2">
              <a href={`${routes.landingPath}#about`} className={linkClassName}>
                About
              </a>
              <a href={`${routes.landingPath}#how-it-works`} className={linkClassName}>
                How it Works
              </a>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2" />
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {isInitializing ? (
              <div className="h-9 w-28 rounded-2xl bg-zinc-200/80" />
            ) : isAuthenticated ? (
              <Link to={routes.dashboardPath}>
                <Button variant="secondary" size="sm">
                  Open App
                </Button>
              </Link>
            ) : (
              <>
                <Link to={routes.loginPath}>
                  <Button variant="secondary" size="sm">
                    Login
                  </Button>
                </Link>
                <Link to={routes.signupPath}>
                  <Button size="sm">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
