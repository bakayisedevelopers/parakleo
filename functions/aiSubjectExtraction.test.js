const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateSubjectClassification,
  validateSubjectMarks,
} = require('./aiSubjectExtraction');

test('validates and normalizes AI subject mark output', () => {
  const result = validateSubjectMarks([
    { subject: 'Maths', mark: 78.4 },
    { subject: 'English', mark: '66' },
    { subject: 'Physics', mark: 61 },
    { subject: 'Chemistry', mark: 74 },
    { subject: '', mark: 80 },
    { subject: 'Economics', mark: 101 },
    { subject: 'English', mark: -1 },
  ]);

  assert.deepEqual(result, [
    { subject: 'English', mark: 66 },
    { subject: 'Maths', mark: 78 },
    { subject: 'Physical Sciences', mark: 74 },
  ]);
});

test('validates object-shaped AI subject mark output', () => {
  const result = validateSubjectMarks({
    subjects: [
      { subject: 'Math Lit', mark: '71' },
      { subject: 'English', mark: 59 },
    ],
  });

  assert.deepEqual(result, [
    { subject: 'English', mark: 59 },
    { subject: 'Maths Lit', mark: 71 },
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
    { value: 'Maths', label: 'Maths' },
    { value: 'English', label: 'English' },
  ]);

  assert.deepEqual(result, {
    subject: 'Maths',
    unsupportedSubject: '',
    topic: 'quadratic equations',
    estimatedMinutes: 32,
    subjectConfidence: 'high',
    needsManualSubjectSelection: false,
    unsupportedSubjectRequested: false,
  });
});

test('identifies unsupported requested subjects separately from fallback', () => {
  const result = validateSubjectClassification({
    subject: '',
    unsupportedSubject: 'unsupported_subject_x',
    topic: 'scales',
    estimatedMinutes: 20,
    subjectConfidence: 'high',
    needsManualSubjectSelection: true,
  }, [
    { value: 'Maths', label: 'Maths' },
    { value: 'English', label: 'English' },
  ]);

  assert.deepEqual(result, {
    subject: '',
    unsupportedSubject: 'unsupported_subject_x',
    topic: 'scales',
    estimatedMinutes: 20,
    subjectConfidence: 'high',
    needsManualSubjectSelection: true,
    unsupportedSubjectRequested: true,
  });
});

test('falls back to manual subject selection when classification is invalid', () => {
  const result = validateSubjectClassification(null, [
    { value: 'Maths', label: 'Maths' },
  ]);

  assert.deepEqual(result, {
    subject: '',
    unsupportedSubject: '',
    topic: '',
    estimatedMinutes: 10,
    subjectConfidence: 'unknown',
    needsManualSubjectSelection: true,
    unsupportedSubjectRequested: false,
  });
});
