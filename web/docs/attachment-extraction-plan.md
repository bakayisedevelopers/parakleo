# Attachment Extraction Implementation Plan (tldraw, Non-AI)

## Document Status
- **Plan owner:** Engineering
- **Scope:** Tutoring session attachment extraction and whiteboard preparation only
- **Whiteboard target:** **tldraw** (current implementation)
- **Out of scope (this plan):** Excalidraw migration, AI interpretation/extraction, auth/WebRTC/payment/session redesign
- **Execution model:** phased delivery with small, independently shippable increments

---

## 1) Current-State Baseline (from existing code)

This plan is aligned to current behavior:

- Student uploads attachments (images/PDFs) during request creation.
- Files are uploaded to storage and saved as metadata (`fileName`, `contentType`, `downloadUrl`, etc.) on class request records.
- Session creation carries request attachment metadata into the session document.
- Session room already initializes a tldraw board (`TldrawSdkEmbed`) using a room key.
- No OCR, PDF text extraction, question parsing, or board auto-placement exists yet.

Implication: we can add extraction as a new pipeline without redesigning the existing session room and matching flows.

---

## 2) End-to-End Attachment Handling Flow

### 2.1 High-level flow
1. **Student uploads attachment(s)** in current request flow (existing).
2. **Backend extraction job is triggered** per uploaded file (new).
3. **File type detection** determines image vs PDF path.
4. **Extraction path chosen:**
   - Image -> OCR
   - PDF -> attempt digital text extraction first; if low-confidence/empty -> OCR per page
5. **Question parsing** runs on extracted text using deterministic rules.
6. **Extraction result is stored** (structured text blocks + question segments + per-page status).
7. During session room entry (or via explicit “Load attachment to board”),
   - selected questions are converted into board-ready content,
   - fallback page/file visuals are also available when extraction is weak/failed.
8. **tldraw board is populated** with either:
   - extracted text blocks (preferred), and/or
   - original page/file visuals (fallback).

### 2.2 Decision tree

```text
Upload file
  -> detect type
    -> image/*
      -> OCR
      -> if OCR usable: parse questions -> board text blocks
      -> else: fallback visual (original image)

    -> application/pdf
      -> try digital PDF text extraction
      -> if extraction usable: parse questions -> board text blocks
      -> else: OCR per page
         -> if OCR usable: parse questions -> board text blocks
         -> else: fallback visual (PDF page images)

    -> unsupported type
      -> mark unsupported and surface to user (non-blocking)
```

---

## 3) File Type Detection and Path Selection

### 3.1 Image vs PDF detection
Use layered detection in this order:
1. MIME type from upload metadata (`contentType`).
2. Extension fallback (`.png`, `.jpg`, `.jpeg`, `.webp`, `.pdf`).
3. If ambiguous, inspect file header magic bytes server-side.

### 3.2 Digital PDF vs scanned PDF determination
For each PDF (prefer per-page checks):
1. Run digital text extractor.
2. Compute text-quality metrics:
   - non-whitespace character count
   - ratio of readable words to symbols
   - average line length / token continuity
3. Classify as **digital-usable** if above thresholds.
4. If below threshold (globally or by page), run OCR for weak pages.

### 3.3 OCR fallback triggers
Trigger OCR when any of these are true:
- digital extractor returns empty text,
- text is below minimum quality threshold,
- specific pages are empty/garbled while others are valid.

### 3.4 “Extraction failed enough” threshold for visual fallback
Use deterministic fail criteria (MVP):
- Entire file: no page with usable text -> fallback whole file/page visuals.
- Partial: some pages usable, some not -> mixed output (text for usable segments + visual pages for failed pages).
- Question parse failure despite usable text: keep raw extracted text block + visual fallback available.

---

## 4) OCR + Extraction Scope (MVP)

### In-scope now
- **Images:** OCR extraction.
- **Scanned PDFs:** OCR extraction (per page).
- **Digital PDFs:** text extraction via PDF text layer.
- **Question extraction:** identify question numbers and associated text where possible.

### Deliberate MVP limits
- Tables, diagrams, geometry figures, and complex layouts are **not reconstructed** in MVP.
- Such content remains visual fallback elements on tldraw.

### Output contract (conceptual)
Each attachment processing result should contain:
- file-level status (`success`, `partial`, `failed`),
- per-page extraction status,
- normalized extracted text,
- parsed question segments (if identified),
- references to fallback render assets (image URL / PDF-page image URLs).

---

## 5) Deterministic Question Detection and Selection Logic

### 5.1 Question boundary rules
Apply deterministic regex/rule-based segmentation:
- Match common starts like `1.`, `1)`, `Q1`, `Question 1`, `2.1`, `(a)`, etc.
- Preserve hierarchy where present (`2`, `2.1`, `2.1.1`).
- If no markers found, chunk text by paragraphs with max character windows.

### 5.2 Question number normalization
Normalize keys into a stable ID format, e.g.:
- `Q1`, `Q2.1`, `Q3(a)`
- Include source coordinates: file index + page index + line span.

### 5.3 Student selection UX (non-AI)
After extraction completes:
- show list of detected questions with short previews,
- allow multi-select (`Q1`, `Q3`, etc.),
- include “Use full page instead” option per page if text is poor.

### 5.4 Isolating selected questions for board prep
When student/tutor selects questions:
- include only selected segments in board text blocks,
- maintain source mapping back to page/file for traceability,
- append fallback visual pages only where selected segment quality is low.

---

## 6) tldraw Integration Plan (Current Whiteboard)

### 6.1 Board content types for MVP
1. **Text cards** for extracted question text.
2. **Image assets** for fallback pages/files.

### 6.2 Placement strategy
Use deterministic vertical stacking:
- Section header shape: attachment name + extraction status.
- Question blocks below header with fixed spacing (e.g., 200–300px gap).
- Add extra workspace gap under each question for tutor annotations.
- Failed/visual fallback pages placed in a separate “Reference” lane to the right.

### 6.3 Partial extraction layout
- Left lane: extracted text questions.
- Right lane: fallback visuals for pages that failed extraction.
- Add labels like “Page 3 visual fallback”.

### 6.4 Session room fit (no redesign)
- Keep existing `SessionRoomPage` and `TldrawSdkEmbed` entry points.
- Add a lightweight board-prep action in session flow (e.g., “Load selected attachment content”).
- Do not alter WebRTC or matching logic.

---

## 7) Failure Handling and UX

### 7.1 Partial success
- Continue session normally.
- Present extracted questions that are valid.
- Mark weak/failed pages and provide one-click visual fallback insertion.

### 7.2 Full extraction failure
- Do **not block** tutoring session.
- Show clear status: “Could not extract text; using original file/page visuals.”
- Insert fallback visual content into tldraw.

### 7.3 What tutor sees
- Extraction summary badge (success/partial/failed).
- Question list (if available).
- Visual fallback references always accessible.

### 7.4 What student sees
- Same status transparency before or at session start.
- Ability to pick questions manually or choose full-page visual mode.

### 7.5 Reliability rules
- Extraction operations are asynchronous and retryable.
- Board load action should proceed with best available output at that moment.

---

## 8) Suggested Technical Structure (Responsibilities)

### 8.1 Frontend responsibilities
- Upload UI remains mostly as-is.
- Show extraction progress/state for each attachment.
- Provide question selection UI (deterministic list, no AI).
- Trigger “prepare board content” request.
- Apply prepared board payload to tldraw via integration utility.

### 8.2 Backend responsibilities
- File type detection and path selection.
- Digital PDF text extraction.
- OCR execution for images/scanned pages.
- Deterministic question parsing and normalization.
- Persist extraction outputs and fallback asset references.

### 8.3 Where processing should happen
- **OCR:** backend (resource-heavy, deterministic libs/services).
- **PDF extraction:** backend.
- **Question parsing:** backend (single canonical behavior).
- **tldraw board preparation:** split:
  - backend: generate normalized “board-ready content model”,
  - frontend: translate model into concrete tldraw shapes/assets in session room.

---

## 9) Phased Delivery Plan (Small Phases with Status + Completion Result)

Status values used:
- `NOT_STARTED`
- `IN_PROGRESS`
- `DONE`
- `BLOCKED`

> Initial statuses below are set to `NOT_STARTED`.

### Phase 0 — Foundation and Contracts

#### 0.1 Data contract definition
- **Status:** `NOT_STARTED`
- **Build:** extraction result schema (file/page/question statuses + fallback refs).
- **Completion result:** frontend and backend share one typed/validated payload contract.

#### 0.2 Persistence fields
- **Status:** `NOT_STARTED`
- **Build:** request/session-level fields to store extraction summary and selectable question list references.
- **Completion result:** extraction state queryable without changing request/session core flow.

---

### Phase 1 — Extraction Engine MVP

#### 1.1 File detection module
- **Status:** `NOT_STARTED`
- **Build:** MIME + extension + optional header sniffing classifier.
- **Completion result:** every attachment deterministically routed to image/PDF paths.

#### 1.2 Digital PDF extraction path
- **Status:** `NOT_STARTED`
- **Build:** extract text from selectable PDF layers; produce per-page quality metrics.
- **Completion result:** digital PDFs produce structured text without OCR when quality is sufficient.

#### 1.3 OCR path (images + scanned PDF pages)
- **Status:** `NOT_STARTED`
- **Build:** OCR runner for images and fallback pages.
- **Completion result:** scanned content returns usable text where possible.

#### 1.4 Failure classification
- **Status:** `NOT_STARTED`
- **Build:** rules for success/partial/failed and fallback visual requirements.
- **Completion result:** deterministic decision on when to show extracted text vs visual fallback.

---

### Phase 2 — Deterministic Question Parsing MVP

#### 2.1 Question marker parser
- **Status:** `NOT_STARTED`
- **Build:** regex/rule segmentation for numbered questions and subparts.
- **Completion result:** extracted text split into candidate question units.

#### 2.2 Normalization + source mapping
- **Status:** `NOT_STARTED`
- **Build:** stable IDs (`Q1`, `Q2.1`) and links to source page spans.
- **Completion result:** selections map reliably back to original document regions.

#### 2.3 Low-confidence fallback behavior
- **Status:** `NOT_STARTED`
- **Build:** when parsing fails, return raw text block + visual fallback flags.
- **Completion result:** no dead-end states; board can still be prepared.

---

### Phase 3 — Session UX + Selection Flow

#### 3.1 Extraction status surfaces
- **Status:** `NOT_STARTED`
- **Build:** student/tutor-visible status chips (processing, partial, failed).
- **Completion result:** users know what was extracted before board load.

#### 3.2 Question selection UI
- **Status:** `NOT_STARTED`
- **Build:** checklist of parsed questions with previews and manual page fallback toggle.
- **Completion result:** explicit, deterministic user choice of what gets loaded.

#### 3.3 Non-blocking session behavior
- **Status:** `NOT_STARTED`
- **Build:** proceed-to-session path regardless of extraction state.
- **Completion result:** extraction never blocks live tutoring.

---

### Phase 4 — tldraw Board Preparation + Insertion

#### 4.1 Board-ready payload formatter
- **Status:** `NOT_STARTED`
- **Build:** transform selected questions/fallback refs into placement-ready model.
- **Completion result:** frontend receives one payload for deterministic layout.

#### 4.2 tldraw insertion utility
- **Status:** `NOT_STARTED`
- **Build:** create text/image shapes with fixed spacing lanes and labels.
- **Completion result:** one-click load places content cleanly on board.

#### 4.3 Mixed mode layout (partial extraction)
- **Status:** `NOT_STARTED`
- **Build:** dual-lane placement (question text + visual fallback references).
- **Completion result:** tutors can work from text while keeping visuals nearby.

---

### Phase 5 — Hardening and Release Gate

#### 5.1 Test matrix
- **Status:** `NOT_STARTED`
- **Build:** fixtures for image OCR, digital PDF, scanned PDF, partial failure.
- **Completion result:** deterministic pass/fail confidence for MVP scenarios.

#### 5.2 Operational guardrails
- **Status:** `NOT_STARTED`
- **Build:** timeouts, retries, max pages/file-size limits, user-safe error messages.
- **Completion result:** stable behavior under real attachment variability.

#### 5.3 MVP release decision
- **Status:** `NOT_STARTED`
- **Build:** checklist sign-off (non-blocking UX + fallback always works).
- **Completion result:** attachment extraction MVP ready for production rollout.

---

## 10) MVP Build-Now vs Defer-Later

### Build now (MVP)
- File detection
- Digital PDF extraction
- OCR fallback for images/scanned pages
- Deterministic question parsing (basic numbering rules)
- Question selection UI
- tldraw text/visual insertion with fixed layout
- Partial/failure fallback behavior

### Defer later
- Table structure reconstruction
- Diagram semantic reconstruction
- Advanced layout recreation
- AI interpretation or tutoring hints
- Excalidraw-related work

---

## 11) Future-Ready Notes (Explicitly Later)

Later iterations can add:
- table extraction and editable table rendering,
- diagram region detection and annotation scaffolds,
- richer visual reconstruction fidelity,
- AI-assisted interpretation and summarization.

These are intentionally excluded from this first implementation to keep MVP narrow, deterministic, and reliable.

---

## 12) Implementation Guardrails

- Keep current request creation, matching, session join, and tldraw mount flow intact.
- Introduce extraction pipeline as additive services and UI states.
- Ensure every failure mode ends in a usable board reference (original visual content).
- Prefer predictable rules over heuristics that are hard to debug.
