# Application Capability Audit (Claxi)

## User types currently supported
- **Guest (not logged in)**: can browse landing page and policy pages, then navigate to login/signup.
- **Student**: can onboard, add payment cards, request classes, join sessions, get billed, top up wallet, and rate sessions.
- **Tutor**: can onboard with document upload and payout details, go online, accept/decline timed offers, manage sessions, and view payout summaries.
- **No admin/staff role is implemented** in routes or role guards.

## Core capabilities by user type

### Guest
- Browse marketing/landing experience.
- Access Terms and Privacy pages.
- Sign up with role selection (`student` or `tutor`) and sign in.

### Student
- Complete onboarding (academic profile + payment method required before requesting).
- Add/manage payment cards (set primary, remove).
- Submit a real-time tutoring request with:
  - topic/description
  - optional image/PDF attachment (filename only)
  - selected card
  - selected duration and displayed price
- Track request matching status while tutors are offered requests.
- View sessions list and enter session room.
- Join a session and choose card for billing.
- End-of-session billing support:
  - attempt card charge
  - if charge fails, move amount to wallet debt
- Top up wallet and clear outstanding debt.
- Submit post-session rating.
- Manage profile, logout, and self-delete account.

### Tutor
- Complete onboarding with:
  - profile photo upload
  - qualification document upload
  - math score threshold (>=60%)
  - payout bank details
- Toggle online/offline availability.
- Receive live class offers with 10-second acceptance window.
- Accepting a request auto-creates a session.
- Declining/timeouts move request to the next tutor in queue.
- Manage sessions:
  - set schedule date/time
  - meeting provider and link
  - notes
  - status updates
- End active session and trigger billing settlement.
- View payout analytics for completed sessions (platform/tutor split).
- Manage profile, logout, and self-delete account.

## Platform/system capabilities
- Real-time subscriptions for requests, sessions, and notifications.
- Notification creation for major flow events.
- Email event queue persisted in Firestore and delivered by Firebase Function + Resend.
- Paystack card verification via Firebase HTTPS function (`verifyPaystack`) with auth token validation.
- Local mock mode fallback when Firebase config is unavailable (via localStorage), enabling non-production demos.

## Important implementation constraints and gaps to fix next
1. **Tutor payments route points to the student wallet page in router config**, so tutor sidebar "Payment" does not render `TutorPaymentsPage` currently.
2. **Request/class status values are mixed between request lifecycle and session lifecycle**, which can create confusing UI states.
3. **No actual video/whiteboard integration yet** (session room uses placeholder messaging).
4. **Billing rate and currency are hard-coded** (`R5/min`, ZAR), limiting flexible pricing models.
5. **No admin/back-office capabilities** (manual verification, refunds, dispute handling, user moderation dashboards).
6. **Attachment handling appears metadata-only in request flow** (request stores filename string; no upload path in request creation).
7. **Potential environment mismatch risk**: frontend uses `VITE_VERIFY_PAYSTACK_ENDPOINT` default `/verify-paystack`, while cloud function export is `verifyPaystack` (deployment rewrite config must map correctly).
8. **Notifications UI is partially wired** (topbar bell is visual; notification feed component exists but is not clearly surfaced in main shell pages).

## Suggested immediate priorities
1. Fix tutor payments route wiring to `TutorPaymentsPage`.
2. Formalize unified state machine for request/session statuses.
3. Add operational admin surface (at least internal tooling) for tutor verification and payment exceptions.
4. Implement attachment upload/storage references for request files.
5. Add proper session media/whiteboard integration or feature-flag placeholders.
