# Admin Web App Supporting Plan (`web/`)

> **Application**: Admin Web Application  
> **Source Directory**: [`web/src/pages/app/admin/`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/)  
> **Parent Master Plan**: [`automation/MASTER_PLAN.md`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/automation/MASTER_PLAN.md)

---

## 1. Discovered App Architecture

- **Entry Point**: [`web/src/main.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/main.jsx)
- **Router Configuration**: [`web/src/App.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/App.jsx)
- **Admin Surfaces**:
  - `AdminDashboardPage`: [`web/src/pages/app/admin/AdminDashboardPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminDashboardPage.jsx)
  - `AdminTutorsPage`: [`web/src/pages/app/admin/AdminTutorsPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminTutorsPage.jsx)
  - `AdminTutorDetailsPage`: [`web/src/pages/app/admin/AdminTutorDetailsPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminTutorDetailsPage.jsx)
  - `AdminTutorAgreementsPage`: [`web/src/pages/app/admin/AdminTutorAgreementsPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminTutorAgreementsPage.jsx)
  - `AdminPaymentsPage`: [`web/src/pages/app/admin/AdminPaymentsPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminPaymentsPage.jsx)
  - `AdminUnsupportedSubjectsPage`: [`web/src/pages/app/admin/AdminUnsupportedSubjectsPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/app/admin/AdminUnsupportedSubjectsPage.jsx)
- **Public & Informational Web Surfaces**:
  - `LandingPage`: [`web/src/pages/LandingPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/LandingPage.jsx)
  - `TutorLandingPage`: [`web/src/pages/TutorLandingPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/TutorLandingPage.jsx)
  - `PortalLandingPage`: [`web/src/pages/portal/PortalLandingPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/portal/PortalLandingPage.jsx)
  - Policy Pages: `PrivacyPolicyPage.jsx`, `TermsPage.jsx`, `RefundPolicyPage.jsx`, `PaymentPricingPolicyPage.jsx`

---

## 2. Milestone Implementation Matrix

### Phase M1 — Tutor Verification Queue & Public Web Surface Realignment
- **Feature IDs**: `ADM-TUTOR-QUEUE`, `ADM-TUTOR-VERIFY`, `ADM-AGREEMENTS`, `SH-PUBLIC-WEBSITES`
- **Existing Implementation**:
  - `AdminTutorsPage.jsx` displays list of all tutors with verification status filter.
  - `AdminTutorDetailsPage.jsx` renders tutor profile, uploaded result documents, police clearance PDF link, and Verify/Reject buttons.
  - `PortalLandingPage.jsx` currently displays CTAs for student login, registration, and class requests.
- **Tasks**:
  1. **Tutor Document Review**: Add optional rejection feedback note in `AdminTutorDetailsPage.jsx` so rejected tutors receive actionable guidance.
  2. **Public Web Realignment (`SH-PUBLIC-WEBSITES`)**:
     - Update [`web/src/pages/portal/PortalLandingPage.jsx`](file:///c:/Users/Jabu%20Babb/Documents/Code/Parakleo/web/src/pages/portal/PortalLandingPage.jsx) and public navigation headers:
       - Replace "Request Class Now" / "Student Login" with "Download Student App" (linking to `https://parakleo-student-download.bakayisedevelopers.co.za`).
       - Replace "Create Tutor Account" / "Tutor Login" with "Download Tutor App" (linking to `https://parakleo-tutors-download.bakayisedevelopers.co.za`).
       - Unlink student/tutor web-app routes from public navigation bars and footers.
     - **Safety Boundary**: Verify that `/admin` and `/app/admin/*` routes remain fully intact, protected by `ProtectedRoute.jsx`, and accessible to authorized administrators.
- **Checks**:
  - Open `/app/admin/tutors/:uid` in browser; verify document links open uploaded PDFs in new tab.
  - Open `/` and `/tutor` in browser; verify CTAs point to APK downloads and no student web-classroom links are exposed.
  - Open `/app/admin`; verify admin login and navigation remain fully operational.

### Phase M6 — Payment Audit & Financial Ledger (27% Platform / 73% Tutor)
- **Feature IDs**: `ADM-PAYMENTS`, `SH-BILLING-SETTLEMENT`
- **Existing Implementation**:
  - `AdminPaymentsPage.jsx` displays total volume, platform fee revenue, tutor earnings, and pending weekly payouts.
- **Tasks**:
  - Ensure the payment ledger displays:
    - Base tuition split: 27% Platform / 73% Tutor
    - 100% of travel fee (R40.00 base + R4.00/km) credited to tutor
    - 100% of booking fee (1%, R1–R2) credited to platform
- **Checks**:
  - Verify ledger mathematical balance across completed session records.
