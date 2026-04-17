import MainLayout from '../layouts/MainLayout';

export default function TermsPage() {
  return (
    <MainLayout>
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 text-zinc-800 dark:text-zinc-200">
        <h1 className="text-4xl font-black text-zinc-900 dark:text-white">Terms of Service</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: March 28, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7">
          <p>By using Claxi, you agree to account verification, live session conduct rules, and billing policies.</p>
          <p>
            Session billing applies at configured rates. Failed charges may create wallet debt balances that must be settled
            before further service use.
          </p>
          <p>
            Tutors receive payouts according to current platform split and payout policies after successful session settlement.
          </p>
          <p>
            Users must provide truthful profile and qualification details. Fraudulent use may result in suspension.
          </p>
          <p>Contact: legal@claxi.app</p>
        </div>
      </section>
    </MainLayout>
  );
}
