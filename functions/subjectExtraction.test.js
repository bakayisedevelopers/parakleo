const test = require('node:test');
const assert = require('node:assert/strict');
const { extractSubjectsAndMarks, normalizeSubjectName } = require('./subjectExtraction');

test('normalizes common South African subject aliases', () => {
  assert.equal(normalizeSubjectName('Maths'), 'Mathematics');
  assert.equal(normalizeSubjectName('Physical Science'), 'Physical Sciences');
  assert.equal(normalizeSubjectName('Zulu'), 'IsiZulu');
  assert.equal(normalizeSubjectName('Math Lit'), 'Mathematical Literacy');
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
