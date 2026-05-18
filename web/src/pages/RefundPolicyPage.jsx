import MainLayout from '../layouts/MainLayout';

export default function RefundPolicyPage() {
  return (
    <MainLayout>
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 text-zinc-800 dark:text-zinc-200">
        <h1 className="text-4xl font-black text-zinc-900 dark:text-white">Refund and Cancellation Policy</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: April 25, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7">
          <p>
            This policy explains how Parakleo handles refunds, cancellations, failed sessions, wallet credits, payment reversals,
            and tutor payout adjustments.
          </p>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">1. Wallet top-ups</h2>
            <p className="mt-3">
              Wallet top-ups are intended for use on Parakleo tutoring sessions. If you add funds by mistake or add the wrong
              amount, contact support promptly with the transaction reference. Approved wallet refunds are returned to the
              original payment method where possible, less any unavoidable third-party payment, banking, chargeback, or fraud
              prevention costs that apply.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">2. Session cancellations</h2>
            <p className="mt-3">
              A student may cancel a request before a tutor accepts it without a session charge. After a tutor accepts a request,
              Parakleo may charge a reasonable cancellation fee if the cancellation causes tutor loss, platform cost, or reserved
              session time. If a tutor cancels or does not attend, the student will not be charged for the tutor&apos;s missed
              session time and may receive a wallet credit or refund where a charge was already captured.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">3. Failed or poor-quality sessions</h2>
            <p className="mt-3">
              If a session cannot reasonably proceed because of a verified Parakleo platform failure, duplicate charge, incorrect
              charge, tutor no-show, or tutor misconduct, Parakleo may issue a refund, partial refund, wallet credit, or session
              credit. If a problem is caused by the student&apos;s device, network, microphone permissions, late arrival, or
              cancellation, the session may remain chargeable.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">4. Disputes and review window</h2>
            <p className="mt-3">
              Refund requests should be submitted within 7 days after the relevant transaction or session. Include the account
              email, session or transaction reference, amount, date, and a short explanation. Parakleo may review session timing,
              connection logs, messages, ratings, payment records, tutor attendance, and support history before deciding.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">5. Processing time</h2>
            <p className="mt-3">
              Approved wallet credits are usually applied quickly. Card refunds depend on the payment provider and issuing bank
              and may take several business days after approval. Parakleo cannot control bank processing times after a refund is
              submitted.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">6. Tutor payout adjustments</h2>
            <p className="mt-3">
              If a student refund, chargeback, duplicate charge, fraud event, or dispute affects a completed session, Parakleo may
              adjust the tutor payout for that session or offset the amount against future payouts, where permitted by law and
              the tutor terms.
            </p>
          </div>

          <p>Contact: support@parakleo.app</p>
        </div>
      </section>
    </MainLayout>
  );
}
