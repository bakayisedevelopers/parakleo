import { Bell, Menu, UserCircle2 } from 'lucide-react';

export default function Topbar({
  onOpenNav,
  name,
  showMenuButton = true,
}) {
  return (
    <header className="mb-5 rounded-[1.5rem] border border-zinc-200 bg-white/90 px-4 py-3 shadow-[0_16px_35px_rgba(15,23,42,0.07)] backdrop-blur md:mb-6 md:rounded-[2rem] md:px-6 md:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center">
          {showMenuButton ? (
            <button
              type="button"
              onClick={onOpenNav}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-700"
              aria-label="Open more navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            className="relative rounded-2xl border border-zinc-200 bg-zinc-50 p-2.5 text-zinc-700 transition hover:bg-zinc-100"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
          </button>
          <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-2.5 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">
              <UserCircle2 className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-zinc-700">{name || 'Claxi User'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
