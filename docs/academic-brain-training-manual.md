# Academic Brain Training & Tightening Manual

## Overview
Academic Brain is a rules + subject-pack engine (no LLM calls) for:
- subject detection
- topic detection
- minute estimation
- question segmentation

Core modules:
- `functions/academicBrain/subjectPacks/index.js`
- `functions/academicBrain/engine.js`
- `functions/academicBrain/text.js`
- `functions/academicBrain/extraction.js`
- feedback writer: `functions/academicBrain/feedback.js`

## Tightening Loop (Recommended)
1. Collect production feedback from `academicBrainFeedback`.
2. Filter by `correctionType` (`subject`, `topic`, `minutes`).
3. For each frequent correction:
- Update relevant subject pack aliases/keywords/topicKeywords.
- Adjust command words and minute rules.
- Add fixture samples to `functions/academicBrain/__fixtures__/cases.json`.
- Add/adjust assertions in `functions/academicBrain/__tests__/engine.test.js`.
4. Run `npm test` inside `functions/`.
5. Deploy functions.

## Subject Pack Tuning
Each subject pack has:
- aliases: high signal, add curriculum naming variants.
- keywords: domain terms, keep high precision.
- topicKeywords: per-topic mapping; use distinct terms.
- commandWords: verbs used in that subject’s questions.
- estimatedMinuteRules: adjust base and per-question timing.

Guidelines:
- Prefer adding specific alias/keyword evidence over broad words.
- Keep overlap between subject packs minimal for precision.
- Version pack updates (field `version`) when changing behavior.

## Question Segmentation Tuning
Implemented boundary support includes:
- `Question 1`, `Q1`, `1.`, `1.1`, `a)`, `(a)`, roman numerals, marks patterns.

To improve:
- extend `isLikelyBoundary` and instruction filters in `engine.js`.
- add examples where parsing failed as fixtures.
- validate with low-confidence outputs (`needsReview`) rather than forcing structure.

## Minute Estimation Tuning
Minute estimate uses:
- base minutes
- per question
- per subquestion
- reading passage bonus

Adjust values in `estimatedMinuteRules` per subject pack based on real corrections.

## Correction Recorder Usage
Feedback endpoint:
- `saveAcademicBrainFeedback` (Firebase Function)

Stored fields include:
- predictedOutput
- correctedOutput
- correctionType
- engineVersion
- subjectPackVersions
- originalOcrText

Use this collection for analytics and rule updates.

## Add New Subject
1. Add pack in `subjectPacks/index.js`.
2. Set `enabled: true` when ready.
3. Add fixture examples + tests.
4. Run tests and deploy.

## Release Checklist
- `functions/npm test` passes.
- Web build passes.
- Feedback writes observed in Firestore.
- OCR + classification smoke-tested with real uploads.
