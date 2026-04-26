const SUBJECT_ALIASES = [
  ['Mathematical Literacy', ['mathematical literacy', 'math literacy', 'math lit', 'maths literacy']],
  ['Physical Sciences', ['physical sciences', 'physical science', 'physics', 'chemistry', 'phys sci']],
  ['Life Sciences', ['life sciences', 'life science', 'biology']],
  ['Computer Applications Technology', ['computer applications technology', 'cat']],
  ['Information Technology', ['information technology', 'it']],
  ['Agricultural Sciences', ['agricultural sciences', 'agricultural science', 'agriculture']],
  ['Business Studies', ['business studies', 'business study', 'business']],
  ['Life Orientation', ['life orientation', 'lo']],
  ['Mathematics', ['mathematics', 'maths', 'math', 'algebra', 'geometry']],
  ['English', ['english', 'english home language', 'english first additional language', 'eng']],
  ['IsiZulu', ['isizulu', 'zulu', 'isi zulu']],
  ['XiTsonga', ['xitsonga', 'xi tsonga', 'tsonga']],
  ['Afrikaans', ['afrikaans']],
  ['Geography', ['geography', 'geo']],
  ['History', ['history']],
  ['Accounting', ['accounting']],
  ['Economics', ['economics']],
  ['Tourism', ['tourism']],
];

const SUBJECT_NAMES = SUBJECT_ALIASES.map(([subject]) => subject);

function normalizeSubjectName(value = '') {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!normalized) return '';

  const match = SUBJECT_ALIASES.find(([, aliases]) => aliases.some((alias) => {
    const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return normalized === normalizedAlias || normalized.includes(normalizedAlias);
  }));

  return match?.[0] || '';
}

function extractMarkNearSubject(line, subjectIndex) {
  const afterSubject = line.slice(subjectIndex);
  const markPatterns = [
    /\b(\d{1,3})(?:\s*\/\s*100|\s*%)\b/g,
    /\blevel\s*[1-7]\s*\/\s*(\d{1,3})\b/gi,
    /\b(?:mark|percentage|result|score)\s*[:=-]?\s*(\d{1,3})\b/gi,
    /\b(\d{1,3})\b/g,
  ];

  for (const pattern of markPatterns) {
    const matches = [...afterSubject.matchAll(pattern)];
    const valid = matches
      .map((match) => Number(match[1]))
      .find((mark) => Number.isFinite(mark) && mark >= 0 && mark <= 100);
    if (valid !== undefined) return valid;
  }

  return null;
}

function extractSubjectsAndMarks(text = '') {
  const lines = String(text || '')
    .split(/\r?\n|;/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const bySubject = new Map();

  lines.forEach((line) => {
    const lowerLine = line.toLowerCase();

    SUBJECT_ALIASES.forEach(([subject, aliases]) => {
      const subjectIndex = aliases.reduce((best, alias) => {
        const index = lowerLine.indexOf(alias.toLowerCase());
        if (index < 0) return best;
        return best < 0 ? index : Math.min(best, index);
      }, -1);

      if (subjectIndex < 0) return;
      const mark = extractMarkNearSubject(line, subjectIndex);
      if (mark === null) return;

      const existing = bySubject.get(subject);
      if (!existing || mark > existing.mark) {
        bySubject.set(subject, { subject, mark });
      }
    });
  });

  return [...bySubject.values()].sort((a, b) => a.subject.localeCompare(b.subject));
}

module.exports = {
  SUBJECT_NAMES,
  normalizeSubjectName,
  extractSubjectsAndMarks,
};
