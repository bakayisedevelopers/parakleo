import { Link, NavLink, useNavigate } from 'react-router-dom';
import { GraduationCap, LogOut, ShieldCheck, UserCircle2, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAdmin } from '../../hooks/useAdmin';
import { getRoleNavigation } from '../../constants/navigation';

const baseClass = 'group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all';

export default function Sidebar({ role, onNavigate, mobile = false }) {
  const { isAdmin } = useAdmin();
  const links = getRoleNavigation(role, { includeAdmin: isAdmin });
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    onNavigate?.();
    navigate('/login');
  };

  return (
    <aside className="flex h-full w-full flex-col rounded-[2rem] border border-white/10 bg-zinc-900/80 p-4 shadow-[0_28px_60px_rgba(2,6,23,0.5)] backdrop-blur">
      <div className="mb-6 flex items-center justify-between px-2 pt-1">
        <Link to="/app" onClick={onNavigate} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-zinc-100">Claxi</p>
            <div className="flex items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">{role} workspace</p>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </span>
              ) : null}
            </div>
          </div>
        </Link>
        {mobile ? (
          <button
            type="button"
            onClick={onNavigate}
            className="rounded-xl border border-white/10 p-2 text-zinc-300"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav className="space-y-1.5">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={Boolean(end)}
            onClick={onNavigate}
            className={({ isActive }) =>
              `${baseClass} ${isActive
                ? 'bg-brand text-white shadow-sm shadow-emerald-200'
                : 'text-zinc-300 hover:bg-zinc-800/90 hover:text-zinc-100'}`
            }
          >
            <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
        <p className="font-semibold">Tip</p>
        <p className="mt-1 leading-relaxed">Keep your profile and availability up to date for a smoother matching experience.</p>
      </div>

      <div className="mt-auto border-t border-white/10 pt-4">
        <NavLink
          to="/app/profile"
          onClick={onNavigate}
          className={({ isActive }) =>
            `${baseClass} ${isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'}`
          }
        >
          <UserCircle2 className="h-4 w-4" />
          Profile
        </NavLink>
        <button
          type="button"
          onClick={handleLogout}
          className={`${baseClass} mt-1 w-full text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100`}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
