import MainLayout from '../layouts/MainLayout';

export default function PaymentPricingPolicyPage() {
  return (
    <MainLayout>
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 text-zinc-800 dark:text-zinc-200">
        <h1 className="text-4xl font-black text-zinc-900 dark:text-white">Payment and Pricing Policy</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: April 25, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7">
          <p>
            This policy explains how Parakleo prices sessions, authorizes cards, manages wallet balances, handles outstanding debt,
            and pays tutors. Amounts are shown in South African rand unless clearly stated otherwise.
          </p>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">1. Session pricing</h2>
            <p className="mt-3">
              Parakleo may calculate a session quote using lesson duration, base amount, rate per minute, subject, time of day,
              demand, tutor availability, seasonal adjustments, discounts, free minutes, and other configuration values shown
              before the request is submitted. Quotes may expire or change if request details, availability, discounts, or
              pricing configuration changes before confirmation.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">2. Card authorization and wallet balance</h2>
            <p className="mt-3">
              Students may be required to add a valid card before requesting a class. Parakleo may authorize, charge, capture,
              reverse, or refund payments through a payment provider. Wallet funds may be used for future sessions. If a charge
              fails or a completed session is not fully paid, the unpaid amount may appear as an outstanding wallet balance that
              must be settled before further use.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">3. Fees and taxes</h2>
            <p className="mt-3">
              Prices may include platform fees, payment processing costs, taxes, discounts, credits, and promotional adjustments
              where applicable. Users are responsible for any taxes, bank charges, data costs, or device costs that apply to
              their own use of Parakleo.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">4. Tutor payouts</h2>
            <p className="mt-3">
              Tutors earn the tutor share shown in the app for eligible completed sessions. The current app configuration uses a
              73% tutor payout share and a 27% platform fee for new completed sessions. Payouts may be grouped weekly and marked
              as unpaid, processing, paid, or adjusted by administrators. Parakleo may delay or withhold payouts for verification,
              suspected fraud, student disputes, chargebacks, incorrect banking details, unlawful activity, or policy violations.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">5. Payment provider handling</h2>
            <p className="mt-3">
              Card entry and sensitive payment processing are handled by third-party payment providers. Parakleo stores only the
              payment metadata needed to operate the service, such as token references, card brand, last four digits, transaction
              IDs, authorization state, and charge outcome. Payment providers may apply their own terms, security standards,
              settlement rules, and compliance obligations.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">6. Changes</h2>
            <p className="mt-3">
              Parakleo may update prices, fees, discounts, payout shares, supported payment methods, and billing rules from time to
              time. Material changes apply prospectively unless required immediately for legal, fraud, security, provider, or
              platform integrity reasons.
            </p>
          </div>

          <p>Contact: billing@parakleo.app</p>
        </div>
      </section>
    </MainLayout>
  );
}
