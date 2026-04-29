const STATUS_META = {
  pending: { label: 'Pending', tone: 'warning' },
  matching: { label: 'Matching Tutors', tone: 'success' },
  offered: { label: 'Tutor Offer Sent', tone: 'success' },
  accepted: { label: 'Accepted', tone: 'success' },
  waiting_student: { label: 'Waiting Student', tone: 'info' },
  in_progress: { label: 'In Progress', tone: 'success' },
  in_session: { label: 'In Session', tone: 'info' },
  completed: { label: 'Completed', tone: 'info' },
  canceled: { label: 'Canceled', tone: 'danger' },
  canceled_during: { label: 'Canceled During Class', tone: 'danger' },
  expired: { label: 'Expired', tone: 'info' },
  no_tutor_available: { label: 'No Tutor Available', tone: 'danger' },
};

export const ACTIVE_REQUEST_STATUSES = [
  'pending',
  'matching',
  'offered',
  'accepted',
  'waiting_student',
  'in_progress',
  'in_session',
];

export function getRequestStatusMeta(status) {
  return STATUS_META[String(status || '').toLowerCase()] || {
    label: String(status || 'Pending').replace(/_/g, ' '),
    tone: 'info',
  };
}
