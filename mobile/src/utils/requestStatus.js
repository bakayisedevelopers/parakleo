import {
  ACTIVE_LESSON_STATUSES,
  ACTIVE_TRACKING_STATUSES,
  CANCELLATION_STATUSES,
  LESSON_STATUS,
  TERMINAL_STATUSES,
  isActiveLessonStatus,
  isActiveTrackingStatus,
  isTerminalStatus,
} from '../constants/lessonStatus';

export function normalizeRequestStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'traveling' || normalized === 'in_transit') return LESSON_STATUS.TRAVELLING;
  return normalized;
}

const STATUS_META = {
  pending: { label: 'Pending', tone: 'warning' },
  matching: { label: 'Matching Tutors', tone: 'success' },
  offered: { label: 'Tutor Offer Sent', tone: 'success' },
  accepted: { label: 'Accepted', tone: 'success' },
  travelling: { label: 'Tutor Travelling', tone: 'success' },
  traveling: { label: 'Tutor Travelling', tone: 'success' },
  in_transit: { label: 'Tutor Travelling', tone: 'success' },
  arrived: { label: 'Tutor Arrived', tone: 'info' },
  waiting_student: { label: 'Waiting Student', tone: 'info' },
  preparing_for_lesson: { label: 'Preparing for Lesson', tone: 'info' },
  in_progress: { label: 'In Progress', tone: 'success' },
  in_session: { label: 'In Session', tone: 'info' },
  ending_requested: { label: 'Ending Requested', tone: 'warning' },
  completed: { label: 'Completed', tone: 'info' },
  settled: { label: 'Settled', tone: 'success' },
  canceled: { label: 'Canceled', tone: 'danger' },
  canceled_during: { label: 'Canceled During Class', tone: 'danger' },
  canceled_by_tutor: { label: 'Canceled by Tutor', tone: 'danger' },
  canceled_by_student: { label: 'Canceled by Student', tone: 'danger' },
  expired: { label: 'Expired', tone: 'info' },
  no_tutor_available: { label: 'No Tutor Available', tone: 'danger' },
};

export const ACTIVE_REQUEST_STATUSES = [
  LESSON_STATUS.PENDING,
  LESSON_STATUS.MATCHING,
  LESSON_STATUS.OFFERED,
  ...ACTIVE_TRACKING_STATUSES,
  ...ACTIVE_LESSON_STATUSES,
  'no_tutor_available',
];

export const JOINABLE_REQUEST_STATUSES = [
  ...ACTIVE_TRACKING_STATUSES,
  ...ACTIVE_LESSON_STATUSES,
];

export const TERMINAL_REQUEST_STATUSES = [
  ...TERMINAL_STATUSES,
  'no_tutor_available',
  'closed',
  'cancelled',
];

export function getRequestStatusMeta(status) {
  return STATUS_META[String(status || '').toLowerCase()] || {
    label: String(status || 'Pending').replace(/_/g, ' '),
    tone: 'info',
  };
}

export function getRequestLifecycleLabel(status) {
  const normalized = normalizeRequestStatus(status);

  if (['pending', 'matching', 'offered'].includes(normalized)) {
    return 'Searching for tutor';
  }

  if (isActiveTrackingStatus(normalized)) {
    return normalized === LESSON_STATUS.ACCEPTED ? 'Tutor found' : 'Tutor tracking';
  }

  if (isActiveLessonStatus(normalized)) {
    return normalized === 'accepted' ? 'Tutor found' : 'Class ready';
  }

  if (normalized === 'no_tutor_available') {
    return 'No tutor available';
  }

  if (['completed', 'settled'].includes(normalized)) {
    return 'Class completed';
  }

  if (isTerminalStatus(normalized) || CANCELLATION_STATUSES.includes(normalized)) {
    return 'Request closed';
  }

  return 'Request update';
}

export function isRequestJoinable(status) {
  return JOINABLE_REQUEST_STATUSES.includes(normalizeRequestStatus(status));
}

export function isActiveRequestStatus(status) {
  return ACTIVE_REQUEST_STATUSES.includes(normalizeRequestStatus(status));
}

export function isTerminalRequestStatus(status) {
  return TERMINAL_REQUEST_STATUSES.includes(normalizeRequestStatus(status));
}
