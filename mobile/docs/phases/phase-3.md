# Phase 3 - Class Request Creation + Attachments + Pricing

Status: Completed

Checklist:
- [x] Added a dashboard-first mobile request composer instead of a separate blank form.
- [x] Added camera/upload entry for image and PDF attachments.
- [x] Added production OCR/classification/pricing service boundaries for the mobile app.
- [x] Added review-before-confirm with duration, subject, selected card, and free-minute preview.
- [x] Persisted request records with `pricingSnapshot`, `attachments`, `selectedCardId`, and `boardPreparationSource`.
- [x] Updated the request list surface to show quote, duration, and attachment summary.

Implementation notes:
- Replaced the dashboard placeholder with `mobile/src/components/student/StudentRequestComposer.js` and mounted it from `mobile/src/screens/student/DashboardScreen.js`.
- Added a `react-native-webview`-backed file chooser bridge in `mobile/src/components/student/AttachmentPickerModal.js` so camera/upload behavior stays available without changing the web app or depending on browser-only inputs.
- Added mobile-native production service boundaries in `mobile/src/services/pricingService.js`, `mobile/src/services/attachmentExtractionService.js`, `mobile/src/services/subjectClassificationService.js`, and `mobile/src/services/storageService.js`.
- Extended `mobile/src/services/classRequestService.js` to write live `classRequests`, queue the matching notification/email event records, and preserve the web request payload shape.
- Added `mobile/src/utils/pricing.js` and `mobile/src/utils/requestStatus.js` so mobile pricing/status rendering stays aligned with the web contracts.
- Added additive PDF OCR support to `functions/index.js` through the existing `extractImageOcr` endpoint so the mobile app can use the production OCR path for both image and PDF attachments.

QA outcomes:
- Confirmed the mobile request flow is wired to production Firebase Functions endpoints: `getPricingQuote`, `classifySubject`, and `extractImageOcr`.
- Confirmed the mobile request payload now includes `pricingSnapshot`, `pricingQuoteId`, `attachments`, `selectedCardId`, and `boardPreparationSource`.
- Did not run Expo/device QA in this sandbox, so attachment chooser behavior and large-file throughput still need manual phone verification.

Pending decisions:
- None for implementation scope.
- Manual review should focus on WebView file chooser behavior on device and large PDF OCR latency.
