export const ALLOWED_SUBJECTS = [
  'Mathematics',
  'Maths Literacy',
  'Physical Sciences',
  'Business Studies',
  'Economics',
  'Accounting',
  'Life Sciences',
  'Agriculture',
  'English',
];

export const GRADE_OPTIONS = [
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
  'University 1st Year',
  'University 2nd Year',
  'University 3rd Year+',
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
