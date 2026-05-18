import MainLayout from '../layouts/MainLayout';

export default function PrivacyPolicyPage() {
  return (
    <MainLayout>
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 text-zinc-800 dark:text-zinc-200">
        <h1 className="text-4xl font-black text-zinc-900 dark:text-white">Privacy Policy</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: April 25, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7">
          <p>
            This Privacy Policy explains how Claxi collects, uses, stores, shares, and protects personal information
            when students, tutors, and administrators use the Claxi website and tutoring platform.
          </p>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">1. Information we collect</h2>
            <p className="mt-3">
              We collect account details such as name, email address, password credentials managed through our authentication
              provider, role, profile photo, referral details, notification preferences, and support messages. Student profiles
              may include grade, curriculum, subject needs, class requests, uploaded attachments, wallet status, ratings, and
              session history. Tutor profiles may include subjects, grades taught, qualification evidence, math score, payout
              banking details, verification status, availability, session history, ratings, and payout records.
            </p>
            <p className="mt-3">
              We also process technical and usage information such as sign-in events, device and browser data, IP-derived
              security signals, session timing, WebRTC connection metadata, screen sharing state, OCR extraction results,
              pricing quotes, payment status, wallet transactions, notification delivery events, and admin audit activity.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">2. How we use information</h2>
            <p className="mt-3">
              We use personal information to create accounts, match students with tutors, verify tutor eligibility, provide live
              sessions, process payments, calculate prices and payouts, manage wallets and outstanding balances, send service
              notifications, prevent fraud and abuse, resolve disputes, improve reliability, comply with legal duties, and keep
              users safe.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">3. Payments and cards</h2>
            <p className="mt-3">
              Claxi uses third-party payment providers to authorize and charge cards. We do not store raw full card numbers or
              CVV codes in our application database. We may store payment tokens, card brand, last four digits, expiry month and
              year, nickname, transaction IDs, authorization status, charge status, refund status, wallet balance, debt balance,
              and related metadata needed to operate the service.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">4. Voice, screen sharing, and attachments</h2>
            <p className="mt-3">
              Live sessions may request microphone access for audio-only WebRTC calls. Tutors may share their screen during a
              class. Claxi processes connection state, ICE candidate metadata, microphone permission status, and screen sharing
              state to connect and troubleshoot sessions. Claxi does not intentionally record live voice calls or screen shares
              unless a specific recording feature is introduced and clearly disclosed.
            </p>
            <p className="mt-3">
              If a user uploads an image or attachment for class preparation, we may process it with OCR or similar extraction
              tools so tutors can understand the question. Uploaded files and extracted text may be stored with the request or
              session for service delivery, quality review, billing support, safety, and dispute handling.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">5. Sharing information</h2>
            <p className="mt-3">
              We share information only as needed to operate Claxi. This may include sharing class requests and session details
              between matched students and tutors, payment information with payment processors, authentication and hosting data
              with cloud providers, OCR data with extraction providers, notifications with email or messaging providers, and
              information with regulators, law enforcement, courts, or advisers where legally required or necessary to protect
              rights, safety, users, and the platform.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">6. Retention</h2>
            <p className="mt-3">
              We keep account, profile, session, request, payment, payout, support, and audit records for as long as needed to
              provide Claxi, meet financial and tax obligations, prevent abuse, resolve disputes, and comply with applicable law.
              Some payment and transaction records may need to be retained after account deletion. Where possible, we delete,
              anonymize, or restrict information that is no longer needed.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">7. Your choices and rights</h2>
            <p className="mt-3">
              You may update your profile information in the app. You may request access, correction, deletion, restriction,
              objection, or account deletion by contacting us. We may need to verify your identity before acting on a request,
              and some requests may be limited by legal, fraud-prevention, safety, tax, payment, or dispute obligations.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">8. Security</h2>
            <p className="mt-3">
              We use reasonable technical and organizational safeguards designed to protect personal information against loss,
              misuse, unauthorized access, disclosure, alteration, and destruction. No online service can guarantee absolute
              security, so users must keep account passwords private and notify us promptly about suspected unauthorized access.
            </p>
          </div>

          <p>Contact: privacy@claxi.app</p>
        </div>
      </section>
    </MainLayout>
  );
}
