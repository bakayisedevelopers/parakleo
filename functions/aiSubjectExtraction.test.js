const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateSubjectClassification,
  validateSubjectMarks,
} = require('./aiSubjectExtraction');

test('validates and normalizes AI subject mark output', () => {
  const result = validateSubjectMarks([
    { subject: 'Maths', mark: 78.4 },
    { subject: 'Zulu', mark: '66' },
    { subject: 'Physics', mark: 61 },
    { subject: 'Chemistry', mark: 74 },
    { subject: '', mark: 80 },
    { subject: 'History', mark: 101 },
    { subject: 'English', mark: -1 },
  ]);

  assert.deepEqual(result, [
    { subject: 'IsiZulu', mark: 66 },
    { subject: 'Mathematics', mark: 78 },
    { subject: 'Physical Sciences', mark: 74 },
  ]);
});

test('validates Gemini subject classification output against supported subjects', () => {
  const result = validateSubjectClassification({
    subject: 'maths',
    topic: 'quadratic equations',
    estimatedMinutes: 32.4,
    subjectConfidence: 'high',
    needsManualSubjectSelection: false,
  }, [
    { value: 'Mathematics', label: 'Mathematics' },
    { value: 'English', label: 'English' },
  ]);

  assert.deepEqual(result, {
    subject: 'Mathematics',
    topic: 'quadratic equations',
    estimatedMinutes: 32,
    subjectConfidence: 'high',
    needsManualSubjectSelection: false,
  });
});
