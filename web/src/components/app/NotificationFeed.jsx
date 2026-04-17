import { Bell } from 'lucide-react';
import EmptyState from '../ui/EmptyState';

export default function NotificationFeed({ notifications }) {
  if (!notifications.length) {
    return <EmptyState title="No notifications yet" description="Real-time updates appear here." compact />;
  }

  return (
    <ul className="space-y-3">
      {notifications.slice(0, 5).map((notification) => (
        <li key={notification.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <Bell className="h-4 w-4 text-brand-light" />
            {notification.title}
          </p>
          <p className="mt-1 text-sm text-zinc-400">{notification.message}</p>
        </li>
      ))}
    </ul>
  );
}
