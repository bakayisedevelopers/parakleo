import { BookOpen, Home, ShieldCheck, Wallet } from 'lucide-react';

export function getRoleNavigation(role, options = {}) {
  const normalized = String(role || 'student').toLowerCase();
  const includeAdmin = Boolean(options.includeAdmin);

  let links;

  if (normalized === 'admin') {
    links = [
      { to: '/app/admin', label: 'Home', icon: Home, end: true },
      { to: '/app/admin/tutors', label: 'Tutors', icon: ShieldCheck },
      { to: '/app/admin/payments', label: 'Payouts', icon: Wallet },
    ];
  } else if (normalized === 'tutor') {
    links = [
      { to: '/app/tutor', label: 'Home', icon: Home, end: true },
      { to: '/app/tutor/my-classes', label: 'Classes', icon: BookOpen },
      { to: '/app/tutor/payments', label: 'Payment', icon: Wallet },
    ];
  } else {
    links = [
      { to: '/app/student', label: 'Home', icon: Home, end: true },
      { to: '/app/student/requests', label: 'My Classes', icon: BookOpen },
      { to: '/app/student/payment', label: 'Payment', icon: Wallet },
    ];
  }

  if (includeAdmin && normalized !== 'admin') {
    links.push({ to: '/app/admin', label: 'Admin', icon: ShieldCheck });
  }

  return links;
}
