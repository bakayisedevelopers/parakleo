export const SUBJECT_OPTIONS = [
  {
    value: 'Mathematics',
    label: 'Mathematics',
  },
];

export const DEFAULT_SUBJECTS = ['Mathematics'];

export function normalizeSubjectList(values = []) {
  return values
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}
