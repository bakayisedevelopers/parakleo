import MainLayout from '../layouts/MainLayout';

export default function TermsPage() {
  return (
    <MainLayout>
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 text-zinc-800 dark:text-zinc-200">
        <h1 className="text-4xl font-black text-zinc-900 dark:text-white">Terms of Service</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: April 25, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7">
          <p>
            These Terms govern use of Claxi by students, tutors, and administrators. By creating an account, signing in,
            requesting a class, accepting a class, joining a session, adding a payment method, or receiving a payout, you agree
            to these Terms and the policies linked from this page.
          </p>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">1. Accounts and eligibility</h2>
            <p className="mt-3">
              You must provide accurate account, profile, payment, and payout information. Students are responsible for class
              requests they submit and payment methods they add. Tutors must provide truthful qualification, subject, grade,
              availability, banking, and identity-related information. Claxi may reject, suspend, restrict, or terminate accounts
              where information is false, unsafe, abusive, unlawful, or creates risk for users or the platform.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">2. Tutoring marketplace</h2>
            <p className="mt-3">
              Claxi provides tools for students to request tutoring and for tutors to accept suitable requests. Tutors are
              independent service providers and are not employees of Claxi unless a separate written agreement says otherwise.
              Claxi may verify tutor profiles, but students and tutors remain responsible for their own conduct, preparation,
              punctuality, communication, and lawful use of the service.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">3. Conduct rules</h2>
            <p className="mt-3">
              Users must not harass, threaten, discriminate, impersonate others, share illegal content, request academic fraud,
              bypass Claxi payments, misuse screen sharing or microphone access, upload malicious files, scrape the service, or
              interfere with platform security. Tutors must teach within their verified capability and treat students
              professionally. Students must use sessions for lawful learning support.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">4. Payments, pricing, and refunds</h2>
            <p className="mt-3">
              Session pricing, wallet funding, card authorization, outstanding debt, platform fees, tutor payouts, cancellations,
              refunds, and disputes are governed by the Payment and Pricing Policy and Refund Policy. Failed charges may create
              a wallet debt balance that must be settled before further service use. Tutors receive payouts only after eligible
              sessions are completed, settled, and cleared for payout.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">5. Live sessions and technology</h2>
            <p className="mt-3">
              Claxi may use WebRTC, microphone access, screen sharing, notifications, OCR, and third-party infrastructure to
              provide sessions. Users are responsible for stable internet, compatible devices, and granting required permissions.
              Claxi may not be liable for failures caused by unsupported devices, blocked networks, third-party outages, user
              settings, or interruptions outside Claxi&apos;s reasonable control.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">6. Content and intellectual property</h2>
            <p className="mt-3">
              Users keep ownership of content they submit, such as questions, images, documents, messages, and profile material.
              Users grant Claxi the rights needed to host, display, process, transmit, extract text from, moderate, and use that
              content to provide, secure, support, and improve the service. Users must have permission to upload any content they
              submit.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">7. Suspension and termination</h2>
            <p className="mt-3">
              Claxi may suspend or terminate access for policy violations, fraud risk, non-payment, chargebacks, unsafe conduct,
              legal requests, repeated disputes, or platform abuse. Users remain responsible for amounts owed before suspension
              or termination.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">8. Disclaimers and liability</h2>
            <p className="mt-3">
              Claxi is provided on an as-is and as-available basis to the extent permitted by law. We do not guarantee any
              specific academic outcome, tutor availability, uninterrupted session, or error-free service. Nothing in these Terms
              excludes liability that cannot be excluded under applicable law.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">9. Contact</h2>
            <p className="mt-3">Legal questions, complaints, and dispute notices may be sent to legal@claxi.app.</p>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
