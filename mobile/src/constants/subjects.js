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
