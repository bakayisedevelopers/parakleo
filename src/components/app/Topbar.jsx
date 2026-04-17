import { Bell, Menu, UserCircle2 } from 'lucide-react';

function getRoleLabel(role) {
  if (String(role).toLowerCase() === 'tutor') return 'Tutor Dashboard';
  if (String(role).toLowerCase() === 'admin') return 'Admin Dashboard';
  return 'Student Dashboard';
}

export default function Topbar({
  onOpenNav,
  name,
  role,
  showMenuButton = true,
}) {
  return (
    <header className="mb-5 rounded-[1.5rem] border border-white/10 bg-zinc-900/70 px-4 py-3 shadow-[0_16px_35px_rgba(2,6,23,0.45)] backdrop-blur md:mb-6 md:rounded-[2rem] md:px-6 md:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {showMenuButton ? (
            <button
              type="button"
              onClick={onOpenNav}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-zinc-800/70 text-zinc-100 md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-6 w-6" />
            </button>
          ) : null}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{getRoleLabel(role)}</p>
            <p className="text-sm font-semibold text-zinc-100 md:text-base">Welcome back, {name?.split(' ')[0] || 'there'}.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            className="relative rounded-2xl border border-white/10 bg-zinc-800/80 p-2.5 text-zinc-200 transition hover:bg-zinc-700"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
          </button>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-800/80 px-2.5 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">
              <UserCircle2 className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-zinc-200">{name || 'Claxi User'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
