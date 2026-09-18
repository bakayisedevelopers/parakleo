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

export function normalizeSessionStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'traveling' || normalized === 'in_transit') return LESSON_STATUS.TRAVELLING;
  return normalized;
}

const SESSION_STATUS_META = {
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
  completed: { label: 'Completed', tone: 'success' },
  settled: { label: 'Settled', tone: 'success' },
  canceled: { label: 'Canceled', tone: 'danger' },
  canceled_during: { label: 'Canceled During Class', tone: 'danger' },
  canceled_by_student: { label: 'Canceled by Student', tone: 'danger' },
  canceled_by_tutor: { label: 'Canceled by Tutor', tone: 'danger' },
  expired: { label: 'Expired', tone: 'info' },
  failed: { label: 'Failed', tone: 'danger' },
};

export const RATABLE_SESSION_STATUSES = [
  LESSON_STATUS.COMPLETED,
  LESSON_STATUS.SETTLED,
  ...CANCELLATION_STATUSES,
];

export const LIVE_SESSION_STATUSES = [
  ...ACTIVE_TRACKING_STATUSES,
  ...ACTIVE_LESSON_STATUSES,
];

export function getSessionStatusMeta(status) {
  return SESSION_STATUS_META[String(status || '').toLowerCase()] || {
    label: String(status || 'Scheduled').replace(/_/g, ' '),
    tone: 'info',
  };
}

export function isLiveSessionStatus(status) {
  return LIVE_SESSION_STATUSES.includes(normalizeSessionStatus(status));
}

export function isTrackingSessionStatus(status) {
  return isActiveTrackingStatus(normalizeSessionStatus(status));
}

export function isActiveSessionStatus(status) {
  return isActiveLessonStatus(normalizeSessionStatus(status));
}

export function isTerminalSessionStatus(status) {
  return isTerminalStatus(normalizeSessionStatus(status));
}
