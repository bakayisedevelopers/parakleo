export const FALLBACK_SUBJECTS = [
  'Mathematics',
  'Physical Sciences',
  'Life Sciences',
  'English',
];

export const SOUTH_AFRICAN_SUBJECTS = [
  'Mathematics',
  'Mathematical Literacy',
  'Physical Sciences',
  'Life Sciences',
  'English',
  'IsiZulu',
  'XiTsonga',
  'Afrikaans',
  'Geography',
  'History',
  'Accounting',
  'Business Studies',
  'Economics',
  'Agricultural Sciences',
  'Computer Applications Technology',
  'Information Technology',
  'Tourism',
  'Life Orientation',
];

export const SUPPORTED_TUTOR_SUBJECTS = [
  ...SOUTH_AFRICAN_SUBJECTS,
  'Sesotho',
  'Sepedi',
  'Setswana',
  'Siswati',
  'Tshivenda',
  'Xitsonga',
  'Ndebele',
  'French',
  'German',
  'Portuguese',
  'Latin',
  'Arabic',
  'Music',
  'Dance Studies',
  'Dramatic Arts',
  'Visual Arts',
  'Religion Studies',
  'Technology',
  'Natural Sciences',
  'Social Sciences',
  'Economic and Management Sciences',
  'Creative Arts',
  'Life Skills',
  'Electrical Technology',
  'Engineering Graphics and Design',
];

export const SUBJECT_OPTIONS = FALLBACK_SUBJECTS.map((subject) => ({
  value: subject,
  label: subject,
}));

export const DEFAULT_SUBJECTS = FALLBACK_SUBJECTS;

export function toSubjectOptions(subjectNames = FALLBACK_SUBJECTS) {
  return normalizeSubjectList(subjectNames).map((subject) => ({
    value: subject,
    label: subject,
  }));
}

export function normalizeSubjectList(values = []) {
  const seen = new Set();
  return values
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
