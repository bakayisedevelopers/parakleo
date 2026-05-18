# Attachment Extraction + Upload-First Request Intake Plan (Current tldraw Stack)

## 0) Purpose, Scope, and Constraints

### Objective
Define a practical implementation plan for improving the **student request intake flow** and adding a deterministic **attachment extraction pipeline** that prepares content for the tutor’s whiteboard workflow.

### Hard constraints for this plan
- Keep the whiteboard on **tldraw** (current implementation).
- Do **not** plan an Excalidraw migration.
- Do **not** use AI for OCR, question extraction, or image understanding.
- Extraction methods allowed:
  - OCR for images and scanned documents.
  - Standard PDF text extraction for digital PDFs.
- AI usage allowed (narrow):
  - **Google Firebase AI Logic only**, for light classification from **text only**:
    - required: subject
    - optional: topic
- Never send raw images/files to AI.
- Do not redesign unrelated systems (WebRTC, auth, payments, full tutor matching redesign).
- Only add request payload fields needed for subject/topic + extraction metadata continuity.

---

## 1) Current Architecture Baseline (Observed)

This plan is grounded in current code behavior:

- Student request creation currently happens from `StudentDashboardPage`, with a textarea + file upload and submit action. Attachments are uploaded via storage service, then sent in the request payload. 
- `createClassRequest` currently hardcodes `subject: 'Mathematics'`, stores attachment metadata, and handles tutor matching lifecycle setup.
- Request details UI already renders uploaded attachments from request metadata.
- Session creation path carries request fields into session records (including `requestAttachment` and whiteboard room id linkage).
- Session room uses `TldrawSdkEmbed` and `whiteboardRoomId || requestId || sessionId` for persistence.
- Platform subject catalog is currently minimal (`SUBJECT_OPTIONS` with only Mathematics).
- No existing OCR / PDF extraction / deterministic question parsing / Firebase AI Logic classification is implemented yet.

This means we can add the new flow as a focused vertical slice without redesigning session transport or the existing tldraw mounting flow.

---

## 2) Student Request Intake UX (Upload-First, Picture-Driven)

## 2.1 UX direction
Request creation should prioritize this order:
1. **Upload attachment(s)** (image/PDF) as the primary, most prominent CTA.
2. Optional quick intent chips.
3. Text description textarea as secondary but always available.
4. Explicit “normal lesson” option (no attachments required).

## 2.2 Proposed request composer sections
- **A. Quick intent options (chips/buttons)**
  - I need help with homework
  - I need help preparing for an exam
  - I need help with an assignment
  - I need a normal lesson
- **B. Upload zone (primary visual area)**
  - drag/drop + click upload
  - supports multiple images/PDFs
  - preview list with remove action
- **C. Optional text area (secondary)**
  - freeform details and context
- **D. Subject state indicator**
  - shows “Subject identified: X” or “Subject needed”
- **E. Continue/Submit CTA**
  - allowed if there is valid intent + required subject resolved

## 2.3 Coexistence behavior
- Attachments and text can both be provided; extraction text and typed text are combined for downstream classification.
- “Normal lesson” can be submitted with no files, but still requires subject resolution.
- Quick intents prefill intent metadata and optional text seed but do not bypass subject validation.

## 2.4 Missing subject UI behavior
- If no clear subject is found, show a **blocking modal** before submit finalization.
- Modal allows selecting only from platform-supported subjects (`SUBJECT_OPTIONS` / backend-validated equivalent).
- No free-typed subject entry in this modal.

---

## 3) Subject Resolution Flow (Deterministic + Firebase AI Logic as helper)

## 3.1 Canonical order of operations
1. Gather candidate text sources:
   - typed description text
   - extracted text from attachments (if any)
2. Attempt deterministic subject match against supported subject list (keyword/alias dictionary).
3. If deterministic match fails/ambiguous:
   - call **Firebase AI Logic** with **text only** (never raw files).
4. Firebase AI Logic returns:
   - `subject` (nullable)
   - `topic` (optional, nullable)
   - `confidence` / `reason` (recommended for audit/debug UX)
5. If result missing/unclear/unsupported subject:
   - show manual subject selection modal.

## 3.2 Typed-text only requests
- If student types “help me with homework” and subject is unclear:
  - deterministic match fails
  - send typed text to Firebase AI Logic
  - if still unclear -> manual subject modal

## 3.3 Attachment-driven requests
- Always extract text first (OCR/PDF extraction).
- Send only extracted text (plus optional typed text) to Firebase AI Logic.
- If extracted text is weak/empty:
  - skip AI classification for that attachment content
  - require manual subject selection

## 3.4 Supported subject enforcement
- Any AI-returned subject must be normalized and validated against supported subject keys.
- If not in supported list -> treat as unresolved and force manual selection.

---

## 4) End-to-End Attachment Handling Flow

## 4.1 Pipeline
1. Student uploads file(s).
2. Store file metadata + create extraction job records.
3. Detect file type.
4. Execute extraction path:
   - image -> OCR
   - PDF -> digital extraction first, OCR fallback as needed
5. Score extraction quality.
6. Parse extracted text into question units (deterministic parser).
7. Persist extraction results + fallback visual references.
8. Resolve subject/topic from text.
9. Prepare board payload for tldraw insertion.
10. In session room, tutor/student loads prepared board content.

## 4.2 Status model (recommended)
Per attachment:
- `queued`
- `processing`
- `success`
- `partial`
- `failed`

Per request summary:
- `all_success`
- `mixed`
- `all_failed`

---

## 5) File Type Detection Logic

## 5.1 Detect image vs PDF
Use layered checks:
1. MIME type from upload metadata (`contentType`).
2. Extension fallback (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, etc.).
3. Optional file signature verification server-side for ambiguous files.

## 5.2 Digital vs scanned PDF detection
Per page:
1. Run digital PDF text extraction.
2. Measure text quality:
   - non-whitespace char count
   - dictionary-like token ratio
   - line continuity
3. If below threshold -> OCR that page.

## 5.3 OCR fallback trigger rules
Trigger OCR when:
- digital extraction is empty, or
- extracted text appears low quality/garbled, or
- page-level extraction missing while other pages succeed.

## 5.4 Extraction-failure threshold for manual subject + visual board fallback
Treat as extraction unusable when:
- no page has usable text; or
- total extracted text length below minimum threshold (e.g., < N chars after cleanup); or
- parser cannot produce any meaningful segments and raw text is unreadable.

Then:
- subject resolution -> manual modal
- board content -> full-page/file visual fallback on tldraw

---

## 6) OCR and Extraction Scope (Current Implementation Target)

## In scope now
- OCR for image uploads.
- OCR for scanned PDF pages.
- Direct text extraction for digital PDFs.
- Deterministic extraction of question numbers + question text where possible.

## In scope but visual-only handling
- diagrams
- tables
- graph-heavy regions
- geometry figures

These should be preserved as image regions/page visuals for whiteboard reference, not reconstructed into semantic blocks in MVP.

## Not in scope now
- AI question extraction
- AI visual interpretation
- sending image pixels/files to AI APIs

---

## 7) Deterministic Question Detection and Parsing

## 7.1 Parsing strategy
Use rule-based segmentation on normalized text with stable regex families:
- numbered starts: `1.`, `2)`, `3 -`
- prefixed markers: `Q1`, `Question 2`
- subparts: `(a)`, `(b)`, `i.`, `ii.`

## 7.2 Grouping logic
- Create segment boundaries at recognized question starts.
- Attach trailing lines to current question until next boundary.
- Preserve page/source coordinates per segment.

## 7.3 Identifier normalization
Normalize to stable ids:
- `Q1`, `Q2`, `Q3a`, `Q3b`
- include metadata: attachment index, page index, line span

## 7.4 Visual association
For each question segment:
- attempt nearest visual association by page and bounding region overlap (if OCR output provides coords).
- if uncertain, attach the full page visual as fallback reference for that question.

## 7.5 Student question selection (later in flow, non-blocking)
- Present parsed question list with short preview.
- Allow selecting one/many questions.
- Include “Use entire page visually” option when text confidence is low.

---

## 8) tldraw Integration Plan (Current Session Room)

## 8.1 Integration principle
Keep `SessionRoomPage` and `TldrawSdkEmbed` as-is; add a board-prep/insertion layer that converts extraction output into tldraw shapes/assets.

## 8.2 Board content types in MVP
- **Text cards**: question number + extracted text.
- **Image assets**: diagrams, uncertain regions, or full-page fallback renders.

## 8.3 Placement algorithm (deterministic)
- Create a left-to-right two-lane layout:
  - Left lane: extracted question text cards
  - Right lane: related visual references
- Vertical spacing:
  - fixed gap per question block (e.g., 400–600 px) to give tutor writing room
- For each question:
  - heading card (`Qn`)
  - body card (text)
  - optional nearby visual image

## 8.4 Full failure layout
If extraction fails fully:
- insert original page/file visuals in sequence
- include top banner note shape: “Text extraction unavailable; using visual reference mode.”

## 8.5 Fit with current room flow
- No WebRTC/lifecycle changes.
- Add a minimal “Load request content to board” action when entering session (or auto-load once per session if safe).
- Board uses existing room key persistence behavior.

---

## 9) Fallback Behavior and Session Continuity

## 9.1 Success
- Use parsed question text + linked visuals on board.

## 9.2 Partial success
- Use valid extracted questions.
- Keep failed/unclear regions as page visuals.
- Mark uncertain segments clearly in UI and board labels.

## 9.3 Full failure
- Do not block request/session.
- Use original visual pages/files on tldraw.
- Prompt student for manual subject selection if unresolved.

## 9.4 Tutor and student UX
- Student sees extraction status during/after request submit.
- Tutor sees readiness state in request/session context (success/partial/failed).
- Both can proceed immediately even if extraction is imperfect.

---

## 10) Suggested Technical Structure (Frontend/Backend Responsibilities)

## 10.1 Frontend
- Upload-first request composer UI and quick-intent controls.
- Subject resolution modal with supported subject list only.
- Extraction status indicators and selection UI.
- Session room action to load prepared board content into tldraw.

## 10.2 Backend / Cloud Functions
- Attachment processing orchestration.
- MIME/type detection and PDF path selection.
- Digital PDF extraction + OCR fallback.
- Deterministic question parser.
- Firebase AI Logic call for text-only subject/topic classification.
- Persist normalized extraction results and board-prep payload.

## 10.3 Where each concern should run
- OCR: backend worker/function.
- PDF extraction: backend worker/function.
- Question parsing: backend worker/function.
- Firebase AI Logic classification: backend (or callable function) using text only.
- tldraw shape creation: frontend in session room from prepared payload.

## 10.4 Request payload compatibility
Extend request/session payloads minimally with additive fields, e.g.:
- `subject` (resolved)
- `topic` (existing/optional enrichment)
- `subjectResolutionSource` (`deterministic` | `firebase_ai_logic` | `manual`)
- `attachmentProcessingSummary`
- `attachmentExtractionRefs`

Keep existing assignment/matching flow intact aside from using resolved subject value instead of hardcoded default.

---

## 11) Architecture and Implementation Phases

## Phase 1 — MVP foundation (build now)
- Add upload-first request UX adjustments (no backend breakage).
- Add subject resolution orchestration:
  - deterministic subject lookup
  - Firebase AI Logic text classification fallback
  - manual subject modal fallback
- Add extraction job model + status surfaces.
- Implement image OCR + PDF digital extraction + OCR fallback.
- Implement deterministic question parser (basic markers).
- Implement tldraw board insertion for:
  - text cards
  - page/image fallback visuals

## Phase 2 — Reliability + polish
- Better per-page quality scoring.
- Partial extraction UX polish.
- Improved visual-question association.
- Retry tooling and admin/debug observability.

## Phase 3 — Deferred / future (not MVP)
- richer table parsing/reconstruction
- diagram region extraction improvements
- advanced board layout templates
- topic analytics dashboards
- AI-assisted interpretation (text+vision), if adopted later under explicit scope change

---

## 12) Failure Handling and UX Rules (Non-Blocking)

## 12.1 Never block core user goals
- Student can always submit a request if subject is selected/resolved.
- Tutor can always start session even if extraction failed.

## 12.2 Error surfaces
- Student intake: clear inline status (“Extraction in progress”, “Partial extraction”, “Using visual fallback”).
- Session room: visible board mode badge (“Text + visuals” or “Visual fallback mode”).

## 12.3 Operational guardrails
- Timeout extraction jobs and mark partial/failed deterministically.
- Keep original attachment references available at all times.
- Avoid destructive retries; store attempt logs for support debugging.

---

## 13) Decision Trees (Quick Reference)

## 13.1 Subject resolution tree
1. Deterministic subject found in supported list? -> use it.
2. Else call Firebase AI Logic with text-only.
3. AI returns supported subject? -> use it (+ optional topic).
4. Else -> manual subject modal (supported list only).

## 13.2 Attachment extraction tree
1. File is image? -> OCR.
2. File is PDF? -> digital extraction.
3. Digital extraction weak? -> OCR per weak page.
4. Usable extracted text available? -> parse questions.
5. No usable text? -> visual fallback placement on tldraw.

---

## 14) Future-Ready Notes (Explicitly Deferred)

These are intentionally not in current MVP scope:
- high-fidelity table-to-structured-content conversion
- diagram semantic reconstruction
- richer visual-to-text mapping heuristics
- robust topic analytics and curriculum insights
- AI-assisted interpretation and recommendation layers

Current MVP remains deterministic extraction + text-only Firebase AI Logic subject/topic classification + robust tldraw fallback.

---

## 15) Implementation Notes Specific to Current Codebase

- The current student intake already accepts files and typed text; convert this to upload-first without replacing existing submit mechanics.
- Current request creation hardcodes Mathematics subject; this must become resolved-subject driven while preserving existing matching lifecycle APIs.
- Existing attachment metadata structure (`attachments[]`, `attachment`) can be reused and extended with extraction references.
- Existing session room/tldraw embed can host board insertion utilities without replacing the whiteboard runtime.

