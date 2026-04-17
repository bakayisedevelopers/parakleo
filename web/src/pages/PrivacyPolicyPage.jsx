import MainLayout from '../layouts/MainLayout';

export default function PrivacyPolicyPage() {
  return (
    <MainLayout>
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 text-zinc-800 dark:text-zinc-200">
        <h1 className="text-4xl font-black text-zinc-900 dark:text-white">Privacy Policy</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: March 28, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7">
          <p>
            Claxi collects account, profile, session, and payment-token metadata to deliver tutoring services,
            process billing, and keep users safe.
          </p>
          <p>
            We do not store raw full card PAN or CVV in our app database. Card authorizations are handled through payment provider flows.
          </p>
          <p>
            We process usage events (session timing, billing, ratings, and notifications) to fulfill service operations,
            dispute handling, and compliance.
          </p>
          <p>
            You may request account deletion from your profile settings. Deletion removes your profile records and access tokens,
            subject to legal and financial retention obligations.
          </p>
          <p>
            Contact: privacy@claxi.app
          </p>
        </div>
      </section>
    </MainLayout>
  );
}
