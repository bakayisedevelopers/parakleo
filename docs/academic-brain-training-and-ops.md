# Academic Brain OCR + Classification Operations Guide

## 1) Current production state
- Hosting deployed: `https://claxi.web.app`
- Functions deployed: project `parakleo`
- Runtime OCR extraction is now simple OCR only (no Paddle, no Gemini fallback in extraction runtime).
- Runtime subject/topic/minutes uses local trainable backend model (`AcademicBrain`) plus local rule fallback.
- Gemini is reserved for training enrichment only (not runtime extraction).

## 2) File map
- `functions/ai/AcademicBrain.js`
- `functions/ai/TrainingPipeline.js`
- `functions/index.js` (`extractImageOcr`, `classifySubject`)
- `frontend/src/services/OcrService.ts`
- `web/src/services/OcrService.ts`
- `mobile/src/services/OcrService.ts`

## 3) Model mechanics
### Text normalization
- Whitespace cleanup and quote normalization.
- OCR typo mapping (`l`/`I` -> `1`, `O`/`o` -> `0` in numeric context).
- Levenshtein token correction against controlled academic vocabulary.

### Subject + topic classification
- `natural.TfIdf` vectors over subject corpora:
  - Mathematics
  - Physics
  - Chemistry
  - Biology
- Subject chosen by highest TF-IDF signal against subject vocabulary.
- Topics ranked from subject topic-vocabulary TF-IDF matches.

### Time estimation
- TensorFlow.js sequential regression model.
- Feature array:
  - word count
  - operator/equation marker count
  - dense math token frequency
  - question marker count
  - numeric token count
- Minutes output is clamped to safe booking range.

### Memory safety
- Tensor allocation is cleaned with `dispose()` in inference/training to prevent leaks.

## 4) Runtime flow
### Extraction runtime (`extractImageOcr`)
- Load attachment payload.
- Run simple Vision OCR route for image/PDF.
- Return extracted text + metadata.

### Classification runtime (`classifySubject`)
- Run `AcademicBrain.classify(inputText)`.
- Combine with local fallback rules.
- Persist training feedback in Firestore `classificationTrainingEvents`.

## 5) Training sources
- Database history (recent requests with usable labels + duration signals).
- Gemini synthetic enrichment (optional enricher callback), used only in training.

Trained artifacts persist under:
- `functions/ml/academic-brain/model.json`
- `functions/ml/academic-brain/corpus.json`
- `functions/ml/academic-brain/topics.json`

## 6) Manual training procedure (recommended now)
Training triggers are intentionally not exposed as live Firebase endpoints yet. Use an ops script.

### Example script outline
Create `functions/scripts/train-academic-brain.js`:

```js
const admin = require('firebase-admin');
const { TrainingPipeline } = require('../ai/TrainingPipeline');
const { AcademicBrain, SUBJECTS } = require('../ai/AcademicBrain');
const { classifySubjectWithAI } = require('../aiSubjectExtraction');

admin.initializeApp();

async function main() {
  const db = admin.firestore();
  const brain = new AcademicBrain();
  await brain.init();

  const pipeline = new TrainingPipeline({
    db,
    logger: console,
    brain,
    geminiEnricher: async (databaseSamples = []) => {
      const out = [];
      for (const s of databaseSamples.slice(0, 120)) {
        const r = await classifySubjectWithAI({
          inputText: String(s.text || '').slice(0, 3000),
          inputPayload: { typedTextPreview: String(s.text || '').slice(0, 1200) },
          supportedSubjects: SUBJECTS.map((x) => ({ value: x, label: x })),
          firebaseConfig: {/* CLAXI_AI_KEYS fields */},
        }).catch(() => null);
        if (!r?.classification) continue;
        out.push({
          text: s.text,
          subject: r.classification.subject,
          topic: r.classification.topic || 'general',
          actualMinutes: Number(r.classification.estimatedMinutes || s.actualMinutes || 30),
        });
      }
      return out;
    },
  });

  await pipeline.init();
  const result = await pipeline.runWeeklyTraining({ lookbackDays: 7 });
  console.log(result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Run:
```bash
node functions/scripts/train-academic-brain.js
```

### Weekly automation
- Short-term: run the script via CI scheduler weekly.
- Long-term: re-enable dedicated scheduled Firebase function after dependency/runtime policy finalization.

## 7) Secrets
- Existing grouped secrets remain:
  - `CLAXI_PAYMENTS_SECRETS`
  - `CLAXI_EMAIL_SECRETS`
  - `CLAXI_REALTIME_SECRETS`
  - `CLAXI_AI_KEYS`
- No new secret key set is required for simple OCR runtime.
- Gemini keys in `CLAXI_AI_KEYS` are needed only when synthetic training enrichment is enabled.

## 8) Post-deploy verification checklist
1. Upload image/PDF and confirm `extractImageOcr` returns text with provider `google-vision`.
2. Submit typed request and confirm `classifySubject` returns subject/topic/minutes.
3. Confirm new rows in Firestore `classificationTrainingEvents`.
4. Run manual training script and verify updated artifacts under `functions/ml/academic-brain/`.
5. Re-run classification and verify stable outputs.

## 9) Runtime note
- Current Functions runtime is Node 20.
- Node 20 deprecation warning appears in deploy output; plan upgrade to Node 22 before decommission deadline.
