const baseThresholds = {
  subject: 0.2,
  topic: 0.15,
  questionBoundary: 0.35,
};

const baseMinuteRules = {
  baseMinutes: 15,
  perQuestionMinutes: 10,
  perSubQuestionMinutes: 2,
  readingPassageBonus: 8,
  maxMinutes: 90,
  minMinutes: 10,
};

function createPack({
  subjectId,
  displayName,
  aliases = [],
  keywords = [],
  topicKeywords = {},
  commandWords = [],
}) {
  return {
    subjectId,
    displayName,
    aliases,
    countriesSupported: ['ZA', 'ZW', 'ZM', 'BW', 'NA', 'LS', 'SZ'],
    languagesSupported: ['en', 'zu', 'af'],
    keywords,
    topicKeywords,
    commandWords,
    numberingPatterns: ['question 1', '1.', '1.1', 'a)', '(a)', 'i)', 'section a'],
    marksPatterns: ['[10]', '(10)', '10 marks', '/10'],
    layoutPatterns: ['section', 'question', 'activity', 'task', 'read the passage'],
    confidenceThresholds: baseThresholds,
    estimatedDifficultyWeights: {
      calculation: 1.1,
      explanation: 1.0,
      essay: 1.3,
      comprehension: 1.2,
      practical: 1.25,
    },
    estimatedMinuteRules: baseMinuteRules,
    parserHints: {
      preferMarksAsBoundaries: true,
      allowUnnumberedInstructionBlocks: true,
    },
    enabled: true,
    version: '1.0.0',
  };
}

const SUBJECT_PACKS = [
  createPack({
    subjectId: 'mathematics',
    displayName: 'Mathematics',
    aliases: ['math', 'maths', 'algebra', 'calculus', 'trigonometry', 'geometry'],
    keywords: ['equation', 'solve', 'factorise', 'simplify', 'graph', 'ratio', 'probability'],
    topicKeywords: {
      algebra: ['equation', 'factorise', 'simplify', 'expression'],
      geometry: ['angle', 'triangle', 'circle', 'theorem'],
      calculus: ['derivative', 'integral', 'limit'],
      statistics: ['mean', 'median', 'probability', 'distribution'],
    },
    commandWords: ['calculate', 'solve', 'prove', 'determine', 'show'],
  }),
  createPack({
    subjectId: 'english',
    displayName: 'English',
    aliases: ['english hl', 'english fal', 'language'],
    keywords: ['essay', 'comprehension', 'summary', 'grammar', 'poem', 'literature'],
    topicKeywords: {
      comprehension: ['passage', 'comprehension', 'read', 'answer'],
      grammar: ['tense', 'punctuation', 'verb', 'noun'],
      literature: ['poem', 'novel', 'character', 'theme'],
    },
    commandWords: ['explain', 'discuss', 'summarise', 'describe', 'quote'],
  }),
  createPack({
    subjectId: 'isizulu',
    displayName: 'isiZulu',
    aliases: ['zulu', 'isizulu hl', 'isizulu fal'],
    keywords: ['isiqondiso', 'indaba', 'inkondlo', 'uhlelo', 'umbuzo'],
    topicKeywords: {
      comprehension: ['funda', 'phendula', 'indaba', 'umbhalo'],
      grammar: ['isabizwana', 'isenzo', 'isiphawulo'],
    },
    commandWords: ['chaza', 'phendula', 'bhala', 'qhathanisa'],
  }),
  createPack({
    subjectId: 'isixhosa',
    displayName: 'isiXhosa',
    aliases: ['xhosa', 'isixhosa hl', 'isixhosa fal', 'isixhosa sal'],
    keywords: ['isicatshulwa', 'umbuzo', 'inkcazo', 'ibali', 'igrama'],
    topicKeywords: {
      comprehension: ['funda', 'isicatshulwa', 'phendula', 'umbhalo'],
      language: ['igrama', 'isivakalisi', 'isenzi'],
    },
    commandWords: ['chaza', 'phendula', 'bhala', 'thelekisa'],
  }),
  createPack({
    subjectId: 'isindebele',
    displayName: 'isiNdebele',
    aliases: ['ndebele', 'isindebele hl', 'isindebele fal', 'isindebele sal'],
    keywords: ['umbuzo', 'indaba', 'isihloko', 'igrama'],
    topicKeywords: {
      comprehension: ['funda', 'phendula', 'umbhalo'],
      language: ['igrama', 'ibizo', 'isenzo'],
    },
    commandWords: ['hlathulula', 'phendula', 'tlola', 'thelekisa'],
  }),
  createPack({
    subjectId: 'afrikaans',
    displayName: 'Afrikaans',
    aliases: ['afrikaans hl', 'afrikaans fal'],
    keywords: ['begrip', 'opstel', 'taal', 'gedig', 'vraag'],
    topicKeywords: {
      comprehension: ['lees', 'beantwoord', 'teks', 'begrip'],
      language: ['werkwoord', 'naamwoord', 'sin'],
    },
    commandWords: ['verduidelik', 'bespreek', 'beantwoord', 'skryf'],
  }),
  createPack({
    subjectId: 'sepedi',
    displayName: 'Sepedi',
    aliases: ['northern sotho', 'sepedi hl', 'sepedi fal', 'sepedi sal'],
    keywords: ['potšišo', 'temana', 'thutapolelo', 'kanegelo'],
    topicKeywords: {
      comprehension: ['bala', 'temana', 'araba'],
      language: ['thutapolelo', 'lediri', 'leina'],
    },
    commandWords: ['hlaloša', 'araba', 'ngwala', 'bapetša'],
  }),
  createPack({
    subjectId: 'sesotho',
    displayName: 'Sesotho',
    aliases: ['southern sotho', 'sesotho hl', 'sesotho fal', 'sesotho sal'],
    keywords: ['potso', 'temana', 'puo', 'pale', 'thutapuo'],
    topicKeywords: {
      comprehension: ['bala', 'temana', 'araba'],
      language: ['thutapuo', 'leetsi', 'lebitso'],
    },
    commandWords: ['hlalosa', 'araba', 'ngola', 'bapisa'],
  }),
  createPack({
    subjectId: 'setswana',
    displayName: 'Setswana',
    aliases: ['tswana', 'setswana hl', 'setswana fal', 'setswana sal'],
    keywords: ['potso', 'temana', 'puiso', 'puo', 'polelo'],
    topicKeywords: {
      comprehension: ['bala', 'temana', 'araba'],
      language: ['polelo', 'lediri', 'leina'],
    },
    commandWords: ['tlhalosa', 'araba', 'kwala', 'bapisa'],
  }),
  createPack({
    subjectId: 'siswati',
    displayName: 'Siswati',
    aliases: ['swati', 'siswati hl', 'siswati fal', 'siswati sal'],
    keywords: ['umbuto', 'umbhalo', 'lulwimi', 'indzaba'],
    topicKeywords: {
      comprehension: ['fundza', 'phendvula', 'umbhalo'],
      language: ['luhlelo', 'sibanjalo', 'sento'],
    },
    commandWords: ['chaza', 'phendvula', 'bhala', 'catsanisa'],
  }),
  createPack({
    subjectId: 'tshivenda',
    displayName: 'Tshivenda',
    aliases: ['venda', 'tshivenda hl', 'tshivenda fal', 'tshivenda sal'],
    keywords: ['mbudziso', 'mafhungo', 'luambo', 'girama'],
    topicKeywords: {
      comprehension: ['vhala', 'fhindula', 'mafhungo'],
      language: ['girama', 'dzina', 'ḽiiti'],
    },
    commandWords: ['ṱalutshedza', 'fhindula', 'ṅwala', 'vhambedza'],
  }),
  createPack({
    subjectId: 'xitsonga',
    displayName: 'Xitsonga',
    aliases: ['tsonga', 'xitsonga hl', 'xitsonga fal', 'xitsonga sal'],
    keywords: ['xivutiso', 'xitshuriwa', 'ririmi', 'n’wini wa mhaka'],
    topicKeywords: {
      comprehension: ['hlaya', 'hlamula', 'xitshuriwa'],
      language: ['girama', 'vito', 'riendli'],
    },
    commandWords: ['hlamusela', 'hlamula', 'tsala', 'fananisa'],
  }),
  createPack({
    subjectId: 'south_african_sign_language',
    displayName: 'South African Sign Language',
    aliases: ['sasl', 'sign language', 'south african sign language', 'sasl hl', 'sasl fal'],
    keywords: ['signed conversation', 'deaf', 'visual language', 'sign'],
    topicKeywords: {
      comprehension: ['interpret', 'meaning', 'context'],
      language: ['grammar', 'structure', 'expression'],
    },
    commandWords: ['identify', 'explain', 'interpret', 'describe'],
  }),
  createPack({
    subjectId: 'physical_sciences',
    displayName: 'Physical Sciences',
    aliases: ['physics', 'chemistry', 'physical science'],
    keywords: ['force', 'energy', 'reaction', 'atom', 'mole', 'velocity'],
    topicKeywords: {
      physics: ['motion', 'force', 'energy', 'electric'],
      chemistry: ['reaction', 'acid', 'base', 'stoichiometry'],
    },
    commandWords: ['calculate', 'derive', 'state', 'explain'],
  }),
  createPack({
    subjectId: 'mathematical_literacy',
    displayName: 'Mathematical Literacy',
    aliases: ['math lit', 'mat lit', 'math literacy'],
    keywords: ['budget', 'interest', 'ratio', 'scale', 'graph', 'measurement'],
    topicKeywords: {
      finance: ['budget', 'interest', 'salary', 'tax'],
      dataHandling: ['graph', 'table', 'mean', 'probability'],
      measurement: ['area', 'volume', 'perimeter', 'scale'],
    },
    commandWords: ['calculate', 'estimate', 'determine', 'interpret'],
  }),
  createPack({
    subjectId: 'natural_sciences',
    displayName: 'Natural Sciences',
    aliases: ['natural science', 'ns'],
    keywords: ['matter', 'energy', 'ecosystem', 'planet', 'experiment'],
    topicKeywords: {
      physicsChem: ['force', 'energy', 'reaction', 'atom'],
      lifeEarth: ['ecosystem', 'cells', 'earth', 'weather'],
    },
    commandWords: ['describe', 'explain', 'investigate', 'identify'],
  }),
  createPack({
    subjectId: 'life_sciences',
    displayName: 'Life Sciences',
    aliases: ['biology', 'life science'],
    keywords: ['cell', 'genetics', 'ecosystem', 'dna', 'photosynthesis'],
    topicKeywords: {
      genetics: ['dna', 'gene', 'inheritance'],
      ecology: ['ecosystem', 'population', 'food chain'],
    },
    commandWords: ['label', 'describe', 'identify', 'explain'],
  }),
  createPack({
    subjectId: 'agricultural_sciences',
    displayName: 'Agricultural Sciences',
    aliases: ['agric', 'agriculture', 'agricultural science'],
    keywords: ['soil', 'crops', 'livestock', 'farming', 'irrigation'],
    topicKeywords: {
      plantProduction: ['crops', 'soil', 'fertiliser', 'irrigation'],
      animalProduction: ['livestock', 'breeding', 'nutrition', 'disease'],
    },
    commandWords: ['explain', 'identify', 'calculate', 'describe'],
  }),
  createPack({
    subjectId: 'geography',
    displayName: 'Geography',
    aliases: ['geo'],
    keywords: ['map', 'climate', 'river', 'settlement', 'topography'],
    topicKeywords: {
      mapwork: ['map', 'grid', 'scale', 'contour'],
      climatology: ['climate', 'rainfall', 'temperature'],
    },
    commandWords: ['interpret', 'identify', 'explain', 'compare'],
  }),
  createPack({
    subjectId: 'tourism',
    displayName: 'Tourism',
    aliases: ['travel and tourism'],
    keywords: ['itinerary', 'destination', 'tourist', 'accommodation', 'attraction'],
    topicKeywords: {
      travelPlanning: ['itinerary', 'budget', 'transport', 'accommodation'],
      tourismIndustry: ['tourist', 'destination', 'attraction', 'sustainability'],
    },
    commandWords: ['plan', 'explain', 'calculate', 'recommend'],
  }),
  createPack({
    subjectId: 'history',
    displayName: 'History',
    aliases: ['historical studies'],
    keywords: ['source', 'evidence', 'war', 'timeline', 'essay'],
    topicKeywords: {
      sourceBased: ['source a', 'source b', 'evidence'],
      essay: ['discuss', 'evaluate', 'argument'],
    },
    commandWords: ['discuss', 'evaluate', 'explain', 'argue'],
  }),
  createPack({
    subjectId: 'consumer_studies',
    displayName: 'Consumer Studies',
    aliases: ['consumer', 'hospitality consumer studies'],
    keywords: ['nutrition', 'consumer', 'budget', 'food production', 'quality'],
    topicKeywords: {
      nutrition: ['nutrition', 'diet', 'food', 'health'],
      consumerEducation: ['consumer', 'rights', 'budget', 'quality'],
    },
    commandWords: ['explain', 'plan', 'calculate', 'evaluate'],
  }),
  createPack({
    subjectId: 'computer_applications_technology',
    displayName: 'Computer Applications Technology',
    aliases: ['cat', 'computer applications', 'computer literacy'],
    keywords: ['spreadsheet', 'database', 'word processing', 'presentation', 'computer'],
    topicKeywords: {
      officeTools: ['spreadsheet', 'word', 'presentation', 'database'],
      digitalConcepts: ['hardware', 'software', 'network', 'internet'],
    },
    commandWords: ['create', 'format', 'calculate', 'explain'],
  }),
  createPack({
    subjectId: 'information_technology',
    displayName: 'Information Technology',
    aliases: ['it subject', 'programming', 'information tech'],
    keywords: ['algorithm', 'program', 'java', 'sql', 'database', 'code'],
    topicKeywords: {
      programming: ['algorithm', 'code', 'loop', 'method', 'class'],
      dataManagement: ['sql', 'database', 'table', 'query'],
    },
    commandWords: ['write', 'debug', 'trace', 'design'],
  }),
  createPack({
    subjectId: 'accounting',
    displayName: 'Accounting',
    aliases: ['accounts', 'bookkeeping'],
    keywords: ['ledger', 'debit', 'credit', 'balance sheet', 'income statement'],
    topicKeywords: {
      financialStatements: ['balance sheet', 'income statement', 'cash flow'],
      ledger: ['debit', 'credit', 'ledger', 'journal'],
    },
    commandWords: ['calculate', 'prepare', 'record', 'explain'],
  }),
  createPack({
    subjectId: 'business_studies',
    displayName: 'Business Studies',
    aliases: ['business'],
    keywords: ['management', 'entrepreneurship', 'marketing', 'business plan'],
    topicKeywords: {
      management: ['leadership', 'management', 'strategy'],
      marketing: ['marketing', 'target market', 'promotion'],
    },
    commandWords: ['discuss', 'analyse', 'recommend', 'justify'],
  }),
  createPack({
    subjectId: 'economics',
    displayName: 'Economics',
    aliases: ['econ', 'economic studies'],
    keywords: ['demand', 'supply', 'inflation', 'gdp', 'market', 'fiscal', 'monetary'],
    topicKeywords: {
      microeconomics: ['demand', 'supply', 'elasticity', 'market structure'],
      macroeconomics: ['gdp', 'inflation', 'fiscal', 'monetary', 'unemployment'],
    },
    commandWords: ['explain', 'calculate', 'analyse', 'discuss'],
  }),
  createPack({
    subjectId: 'life_orientation',
    displayName: 'Life Orientation',
    aliases: ['lo', 'life orientation'],
    keywords: ['wellbeing', 'citizenship', 'careers', 'health', 'values'],
    topicKeywords: {
      personalDevelopment: ['wellbeing', 'health', 'stress', 'goals'],
      citizenship: ['rights', 'responsibility', 'community', 'democracy'],
    },
    commandWords: ['discuss', 'reflect', 'explain', 'describe'],
  }),
  createPack({
    subjectId: 'economic_management_sciences',
    displayName: 'Economic and Management Sciences',
    aliases: ['ems', 'economic management sciences'],
    keywords: ['entrepreneur', 'business', 'economy', 'accounting', 'market'],
    topicKeywords: {
      business: ['business', 'entrepreneur', 'management'],
      economy: ['economy', 'market', 'scarcity'],
      accounting: ['income', 'expense', 'ledger'],
    },
    commandWords: ['identify', 'explain', 'calculate', 'analyse'],
  }),
  createPack({
    subjectId: 'social_sciences',
    displayName: 'Social Sciences',
    aliases: ['ss', 'social science'],
    keywords: ['history', 'geography', 'map', 'society', 'heritage'],
    topicKeywords: {
      history: ['past', 'events', 'sources', 'heritage'],
      geography: ['map', 'climate', 'landform', 'settlement'],
    },
    commandWords: ['describe', 'compare', 'explain', 'interpret'],
  }),
];

function loadEnabledSubjectPacks() {
  return SUBJECT_PACKS.filter((pack) => pack.enabled);
}

module.exports = {
  SUBJECT_PACKS,
  loadEnabledSubjectPacks,
};
