function normalizeText(value = '') {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const SUBJECT_RULES = {
  Mathematics: ['algebra', 'equation', 'solve for x', 'trigonometry', 'calculus', 'geometry', 'probability', 'factorise'],
  'Physical Sciences': ['physics', 'chemistry', 'newton', 'mole', 'energy', 'acid', 'base', 'reaction', 'force'],
  'Life Sciences': ['biology', 'cell', 'photosynthesis', 'genetics', 'ecosystem', 'organism'],
  Accounting: ['balance sheet', 'ledger', 'debit', 'credit', 'trial balance', 'income statement'],
  Economics: ['supply', 'demand', 'inflation', 'gdp', 'market', 'fiscal', 'monetary'],
  Geography: ['map', 'climate', 'erosion', 'topography', 'latitude', 'longitude'],
  History: ['source', 'historical', 'war', 'timeline', 'apartheid', 'revolution'],
  English: ['essay', 'grammar', 'comprehension', 'poem', 'literature', 'language'],
};

function mapSupportedSubjects(supportedSubjects = []) {
  const map = new Map();
  supportedSubjects.forEach((subject) => {
    const value = String(subject?.value || subject || '').trim();
    const label = String(subject?.label || '').trim();
    if (value) map.set(value.toLowerCase(), value);
    if (label) map.set(label.toLowerCase(), value);
  });
  return map;
}

function classifySubjectLocally({ text = '', supportedSubjects = [] } = {}) {
  const normalizedText = normalizeText(text);
  const supportedMap = mapSupportedSubjects(supportedSubjects);
  const scoreBySubject = new Map();
  const matchedBySubject = new Map();

  Object.entries(SUBJECT_RULES).forEach(([subject, keywords]) => {
    const canonical = supportedMap.get(subject.toLowerCase()) || subject;
    let score = 0;
    const matched = [];
    keywords.forEach((keyword) => {
      if (normalizedText.includes(keyword)) {
        score += keyword.split(' ').length > 1 ? 2 : 1;
        matched.push(keyword);
      }
    });

    if (score > 0) {
      scoreBySubject.set(canonical, (scoreBySubject.get(canonical) || 0) + score);
      matchedBySubject.set(canonical, [...(matchedBySubject.get(canonical) || []), ...matched]);
    }
  });

  const ranked = [...scoreBySubject.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) {
    return {
      subject: '',
      subjectConfidence: 'unknown',
      confidenceScore: 0,
      matchedKeywords: [],
      method: 'local',
      needsGeminiFallback: true,
      reason: 'no_local_match',
    };
  }

  const [topSubject, topScore] = ranked[0];
  const secondScore = ranked[1]?.[1] || 0;
  const delta = topScore - secondScore;
  const confidenceScore = Math.max(0, Math.min(1, (topScore / 8) + (delta / 10)));
  const subjectConfidence = confidenceScore >= 0.72 ? 'high' : (confidenceScore >= 0.48 ? 'low' : 'unknown');

  return {
    subject: supportedMap.get(topSubject.toLowerCase()) || topSubject,
    subjectConfidence,
    confidenceScore,
    matchedKeywords: [...new Set(matchedBySubject.get(topSubject) || [])].slice(0, 15),
    method: 'local',
    needsGeminiFallback: subjectConfidence !== 'high',
    reason: subjectConfidence === 'high' ? 'high_confidence_local_subject' : 'low_confidence_local_subject',
  };
}

module.exports = {
  classifySubjectLocally,
};
