# Admin Web App Features (`web/`)

> **Application**: Admin Web Application  
> **Repository Path**: [`web/src/pages/app/admin/`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/)  
> **Tech Stack**: React 18.2.0, Vite 5.0.8, React Router v6, Tailwind CSS 3.4.1, Firebase JS SDK 11.10.0, Lucide Icons  
> **Scope Notice**: Admin Web is the **only operational web application** in the launch plan. All operational routes and authentication are active and maintained.

---

## Cross-App Journeys Referenced
- **`JRN-TUT-ONBOARD`**: Tutor Onboarding Review, Document Verification, and Approval
- **`JRN-SET-BILL`**: Financial Ledger, Payment Transaction Monitoring, and Tutor Payout Processing

---

## Feature Inventory

### `ADM-AUTH`: Admin Role-Based Access Control
- **Behaviour**: Protects admin routes behind strict authentication and authorization guards. Verifies that the signed-in user has `role: 'admin'`, `isAdmin: true`, or an authorized admin email before rendering back-office surfaces.
- **Owning App**: Admin Web App (`web/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`web/src/components/app/ProtectedRoute.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/components/app/ProtectedRoute.jsx), [`web/src/context/AuthContext.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/context/AuthContext.jsx), [`firestore.rules`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/firestore.rules)
- **Unresolved Decisions**: None.

### `ADM-DASHBOARD`: Operational Platform Command Center
- **Behaviour**: High-level operational overview showing active metrics: total registered students, pending tutor verification applications, active online tutors, total completed lessons, platform revenue (27% commission + booking fees), and pending weekly payouts.
- **Owning App**: Admin Web App (`web/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`web/src/pages/app/admin/AdminDashboardPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminDashboardPage.jsx)
- **Unresolved Decisions**: None.

### `ADM-TUTOR-QUEUE`: Tutor Applications & Verification Backlog
- **Behaviour**: Part of **`JRN-TUT-ONBOARD`**. Displays a filterable queue of all registered tutors categorized by verification status (`pending`, `verified`, `rejected`). Displays summary badges indicating whether academic transcripts, police clearance, and signed legal agreements have been submitted.
- **Owning App**: Admin Web App (`web/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`web/src/pages/app/admin/AdminTutorsPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminTutorsPage.jsx), [`web/src/services/userService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/services/userService.js)
- **Unresolved Decisions**: None.

### `ADM-TUTOR-VERIFY`: Document Audit & Approval/Rejection Action
- **Behaviour**: Part of **`JRN-TUT-ONBOARD`**. Detailed tutor review screen displaying:
  - Full personal profile and uploaded selfie/photo
  - Academic result documents (Matric certificate, degree transcripts) with direct PDF view links
  - Police clearance certificate PDF
  - Right-to-work identity documentation: South African ID document, or passport plus valid South African work visa/right-to-work evidence
  - Qualified subjects and grade levels to tutor
  - Signed agreement status
  Admin can approve (`updateStatus('verified')`) or reject (`updateStatus('rejected')`). Verification enables the tutor to go online in the Tutor Mobile App and receive class offers. Police clearance and identity/right-to-work documents must be manually reviewed by an admin and must not be AI-approved. Rejection should persist a clear reason and trigger/record the private-document deletion expectation within 24 hours.
- **Owning App**: Admin Web App (`web/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed baseline in code; approved right-to-work hardening (`REQ-007`) pending implementation.
- **Dependencies & References**: [`web/src/pages/app/admin/AdminTutorDetailsPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminTutorDetailsPage.jsx), [`web/src/services/tutorDocumentService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/services/tutorDocumentService.js), [`web/src/services/userService.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/services/userService.js)
- **Unresolved Decisions**: None.

### `ADM-AGREEMENTS`: Legal Contractor Agreement Management
- **Behaviour**: Part of **`JRN-TUT-ONBOARD`**. Review all tutor signed agreements, inspect signature timestamps and agreement version hashes, and publish new agreement versions with automated notifications to active tutors. The published Tutor Agreement must clearly disclose first-time-user promotional lesson payout treatment: tutors receive 75% of the discounted total amount paid/settled for that promotional lesson, inclusive of travel and lesson compensation. The disclosure should be visually prominent in the agreement content and versioned so signed records prove the tutor accepted it.
- **Owning App**: Admin Web App (`web/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed baseline in code; approved agreement update (`REQ-006`) pending implementation.
- **Dependencies & References**: [`web/src/pages/app/admin/AdminTutorAgreementsPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminTutorAgreementsPage.jsx), [`functions/legalAgreements.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/legalAgreements.js)
- **Unresolved Decisions**: None.

### `ADM-PAYMENTS`: Financial Ledger, Paystack Transactions & Tutor Payouts
- **Behaviour**: Part of **`JRN-SET-BILL`**. Financial management interface providing:
  - Real-time ledger of completed session billings, platform commissions (27%), booking fees (100% platform), and tutor earnings (73% tuition + 100% travel fee).
  - Weekly tutor payout batches with verified bank account numbers and branch codes.
  - Paystack transaction audit and outstanding debt collections.
- **Owning App**: Admin Web App (`web/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`web/src/pages/app/admin/AdminPaymentsPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminPaymentsPage.jsx), [`functions/pricingEngine.js`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/functions/pricingEngine.js)
- **Unresolved Decisions**: None.

### `ADM-SUBJECTS`: Unsupported Subject Demand Tracking
- **Behaviour**: Logs requests submitted by students for subjects not yet in the official curriculum catalog. Allows admin to track unmet market demand and prioritize recruiting tutors in those subjects.
- **Owning App**: Admin Web App (`web/`)
- **Lifecycle**: Required before initial launch
- **Implementation Status**: Confirmed in code
- **Dependencies & References**: [`web/src/pages/app/admin/AdminUnsupportedSubjectsPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminUnsupportedSubjectsPage.jsx)
- **Unresolved Decisions**: None.
