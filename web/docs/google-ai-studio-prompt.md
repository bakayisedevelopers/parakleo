# Google AI Studio build prompt (Claxi + Uber/Bolt-style UI revamp)

Use the prompt below in Google AI Studio.

---

You are a senior product engineer. Rebuild and improve my existing tutoring marketplace app called **Claxi** using the **same technology stack and architecture**, while revamping the UI to feel like a premium **Uber/Bolt-style experience** (mobile-first, map/app-ride vibe, clear status progression, bold CTAs, modern cards, bottom navigation).

## 1) Non-negotiable stack (must match existing project)
- Frontend: **React 18 + Vite + JavaScript (JSX)**
- Styling: **Tailwind CSS**
- Routing: **react-router-dom v6**
- Realtime + backend services: **Firebase Auth + Firestore + Firebase Storage** (modular SDK)
- Backend/server functions: **Firebase Functions (Node 20, CommonJS)**
- Email delivery: **Resend via Cloud Functions**
- Icons/UI helpers: **lucide-react** (and current motion package if needed)

Do not switch to Next.js, TypeScript, Redux, Supabase, or a different backend. Keep this stack.

## 2) Product goal
Claxi is an online-first tutoring marketplace where:
- Students create live class requests.
- Tutors receive/accept requests in near real time.
- A session is created and managed live (status, scheduling, meeting link, billing).
- Notifications and transactional emails keep both users updated.

## 3) Existing route architecture to preserve
Keep role-based routing and protected app shell structure:
- Public: `/`, `/login`, `/signup`, `/privacy-policy`, `/terms`
- App shell: `/app`
- Shared: `/app/profile`, `/app/onboarding`, `/app/session/:id`
- Student: `/app/student`, `/app/student/request`, `/app/student/request-class`, `/app/student/sessions`, `/app/student/payment`
- Tutor: `/app/tutor`, `/app/tutor/available-requests`, `/app/tutor/my-classes`, `/app/tutor/sessions`, `/app/tutor/payments`

## 4) Data model and realtime behavior to preserve
Use these collections and keep subscription-based live updates:
- `users`
- `classRequests`
- `sessions`
- `notifications`
- `emailEvents`

Must preserve these behaviors:
- Student request creation and tutor matching queue.
- Tutor offer/accept flow with status transitions.
- Session lifecycle updates in real time.
- Notification creation for key events.
- Email events queued and processed by Cloud Function.
- Fallback mode when Firebase env vars are missing (local/mock mode behavior).

## 5) Critical “what still needs to happen” (implement these)
Implement the unfinished/weak areas while preserving core logic:
1. **Session room completion**
   - Replace current whiteboard/call placeholders with production-ready integration points and realistic UI states.
   - Keep timer, billing, join/end flow, and rating UX; improve reliability and UX clarity.
2. **Payments hardening**
   - Replace/mock-only card charge behavior with real backend-mediated payment flow for production-safe charging.
   - Keep Paystack verification flow via authenticated function endpoint and secure secret handling.
3. **Tutor payments routing/UI consistency**
   - Ensure tutor payment route renders tutor-specific payout page (not student wallet view).
4. **Mobile-first operational UX**
   - Improve role dashboards for fast actions: request class, accept class, join session, update link/status, view balances.
5. **Design system polish**
   - Consolidate component variants, spacing, typography, status colors, empty/loading/error states.

## 6) Uber/Bolt-inspired UI revamp direction
Apply this design language while keeping Claxi branding:
- **Mobile-first first**: 390px baseline, sticky bottom nav, thumb-zone primary actions.
- **Status-forward screens**: request lifecycle and session lifecycle should feel like ride-tracking steps.
- **High-contrast action hierarchy**: one dominant CTA per screen.
- **Card-based surfaces** with subtle elevation, rounded corners, and clean shadows.
- **Context chips/badges** for status (`matching`, `offered`, `accepted`, `waiting_student`, `in_progress`, `completed`, billing states).
- **Top-level quick actions** (like ride app shortcuts):
  - Student: “Request class now”, “Join current session”, “Top up wallet”.
  - Tutor: “View live requests”, “Start/Update session”, “View earnings”.
- **Motion restraint**: fast transitions, no heavy animations.
- **Accessibility**: color contrast, focus states, keyboard navigation, aria labels.

## 7) Required technical deliverables
Generate and/or modify code with this output structure:
1. Updated file tree.
2. Core layout and navigation components (desktop sidebar + mobile bottom nav).
3. Refined page implementations for student and tutor flows.
4. Production-safe service layer updates (especially payments/session transitions).
5. Firebase Functions updates needed for payment verification/charging/webhook-safe patterns.
6. Tailwind design tokens/theme adjustments.
7. Migration notes for environment variables and Firebase deploy steps.
8. A QA checklist with route-by-route acceptance criteria.

## 8) Constraints and quality bar
- Keep existing domain semantics, role logic, and Firestore collection naming.
- Avoid breaking changes unless explicitly documented with migration instructions.
- Preserve readable, modular components and service boundaries.
- Include defensive error handling and empty/loading states on all data-driven screens.
- Keep performance in mind (avoid unnecessary re-renders and expensive listeners).

## 9) Output format (strict)
Respond with:
1. **Implementation Plan** (phased).
2. **Concrete code patches per file** (complete, copy-pasteable).
3. **Post-change verification steps** (`npm run build`, core manual checks).
4. **Risk list + rollback plan**.

If any assumptions are needed, state them explicitly before generating code.

---

Tip for Google AI Studio run settings:
- Ask for multi-file output in small batches (layout/navigation first, then services/functions, then pages) to reduce truncation.
