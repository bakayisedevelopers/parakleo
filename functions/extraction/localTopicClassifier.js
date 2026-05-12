function normalizeText(value = '') {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const TOPIC_RULES = {
  Mathematics: {
    Algebra: ['algebra', 'equation', 'factorise', 'quadratic', 'simultaneous'],
    Trigonometry: ['trig', 'sine', 'cosine', 'tangent'],
    Geometry: ['angle', 'triangle', 'circle', 'theorem'],
    Calculus: ['differentiate', 'integrate', 'derivative', 'limit'],
  },
  'Physical Sciences': {
    Mechanics: ['force', 'newton', 'velocity', 'acceleration'],
    Electricity: ['current', 'voltage', 'resistance', 'circuit'],
    Chemistry: ['reaction', 'mole', 'acid', 'base', 'stoichiometry'],
  },
  Accounting: {
    Bookkeeping: ['ledger', 'debit', 'credit', 'journal'],
    FinancialStatements: ['income statement', 'balance sheet', 'cash flow'],
  },
};

function detectTopicsLocally({ text = '', subject = '' } = {}) {
  const normalizedText = normalizeText(text);
  const subjectRules = TOPIC_RULES[subject] || {};
  const topicScores = [];

  Object.entries(subjectRules).forEach(([topic, keywords]) => {
    let score = 0;
    const matched = [];
    keywords.forEach((keyword) => {
      if (normalizedText.includes(keyword)) {
        score += keyword.includes(' ') ? 2 : 1;
        matched.push(keyword);
      }
    });

    if (score > 0) {
      topicScores.push({ topic, score, matchedKeywords: matched });
    }
  });

  topicScores.sort((a, b) => b.score - a.score);
  const top = topicScores[0];
  const total = topicScores.reduce((sum, item) => sum + item.score, 0);
  const confidence = total > 0 && top ? Math.max(0, Math.min(1, top.score / Math.max(total, 1))) : 0;

  if (!top) {
    return {
      topics: [],
      topic: '',
      topicConfidence: 'unknown',
      confidenceScore: 0,
      matchedKeywords: [],
      method: 'local',
      needsGeminiFallback: true,
      reason: 'no_topic_match',
    };
  }

  const topicConfidence = confidence >= 0.72 ? 'high' : (confidence >= 0.45 ? 'low' : 'unknown');

  return {
    topics: topicScores.slice(0, 3).map((item) => item.topic),
    topic: top.topic,
    topicConfidence,
    confidenceScore: confidence,
    matchedKeywords: [...new Set(topicScores.flatMap((item) => item.matchedKeywords))].slice(0, 20),
    method: 'local',
    needsGeminiFallback: topicConfidence !== 'high',
    reason: topicConfidence === 'high' ? 'high_confidence_local_topic' : 'low_confidence_local_topic',
  };
}

module.exports = {
  detectTopicsLocally,
};
