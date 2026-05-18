const test = require('node:test');
const assert = require('node:assert/strict');
const { extractSubjectsAndMarks, normalizeSubjectName, isAllowedGrade1To12Subject } = require('./subjectExtraction');

test('normalizes common South African subject aliases', () => {
  assert.equal(normalizeSubjectName('Maths'), 'Mathematics');
  assert.equal(normalizeSubjectName('Physical Science'), 'Physical Sciences');
  assert.equal(normalizeSubjectName('Zulu'), 'IsiZulu');
  assert.equal(normalizeSubjectName('Math Lit'), 'Mathematical Literacy');
  assert.equal(normalizeSubjectName('English FAL'), 'English');
  assert.equal(normalizeSubjectName('Afrikaans HL'), 'Afrikaans');
});

test('allows only grade 1 to 12 school subjects', () => {
  assert.equal(isAllowedGrade1To12Subject('Mathematics'), true);
  assert.equal(isAllowedGrade1To12Subject('English FAL'), true);
  assert.equal(isAllowedGrade1To12Subject('Afrikaans HL'), true);
  assert.equal(isAllowedGrade1To12Subject('Psychology'), false);
  assert.equal(isAllowedGrade1To12Subject('Financial Accounting'), false);
});

test('extracts subjects and percentage marks from result text', () => {
  const result = extractSubjectsAndMarks(`
    Mathematics 78%
    Physical Sciences: 65
    English Home Language Level 5 / 70
    History 42
    Accounting 101
  `);

  assert.deepEqual(result, [
    { subject: 'English', mark: 70 },
    { subject: 'History', mark: 42 },
    { subject: 'Mathematics', mark: 78 },
    { subject: 'Physical Sciences', mark: 65 },
  ]);
});

test('maps common subject variations into normalized tutor subjects', () => {
  const result = extractSubjectsAndMarks(`
    Physics 74%
    Chemistry 69%
    Xitsonga Home Language 81%
    Zulu Home Language 66%
  `);

  assert.deepEqual(result, [
    { subject: 'IsiZulu', mark: 66 },
    { subject: 'Physical Sciences', mark: 74 },
    { subject: 'XiTsonga', mark: 81 },
  ]);
});

test('prefers the trailing tabular mark for subject rows', () => {
  const result = extractSubjectsAndMarks(`
    Mathematics 123456 7 78
    English Home Language 99887 5 70
    Life Sciences
    64
  `);

  assert.deepEqual(result, [
    { subject: 'English', mark: 70 },
    { subject: 'Life Sciences', mark: 64 },
    { subject: 'Mathematics', mark: 78 },
  ]);
});
