# Student Growth V1 (Free Minutes + Referrals)

## What was implemented

This V1 adds a conservative free-minute growth system for students:

- New student accounts are initialized with **90 free minutes**.
- Each student has a shareable `referralCode`.
- Signup accepts optional referral code capture (`?ref=CODE` or typed code).
- Referral rewards are granted only after account completion criteria is met:
  - account exists
  - email is verified
- Referrer receives **+30 free minutes** once per valid referred student.
- Session pricing now keeps:
  - original/originally-calculated price
  - free-minute discount value
  - final payable student price
- Tutor payout remains based on the original lesson value.
- Free minutes are consumed at session completion (not at request creation).

## Firestore model updates

### `users/{uid}` new/used fields

- `freeMinutesRemaining: number`
- `referralCode: string`
- `referredBy: string | null`
- `pendingReferralCode: string | null` (captured during signup, resolved later)
- `referralRewardCount: number`
- `totalFreeMinutesEarned: number`
- `totalFreeMinutesUsed: number`
- `emailVerified: boolean`
- `emailVerifiedAt: timestamp | null`
- `growth: { ... }`
  - `completionRequirements.emailVerified`
  - `completionRequirements.phoneVerified` (placeholder for future phone requirement)
  - `accountCompletionRewardProcessed`
  - `accountCompletionQualifiedAt`
  - `lastGrowthSyncedAt`

### `referrals/{referrerId_referredUserId}`

- `referrerId`
- `referredUserId`
- `referralCode`
- `status` (`completed` in current V1 path)
- `rewardGranted`
- `rewardMinutesGranted`
- `createdAt`
- `completedAt`
- `updatedAt`

## Where logic is applied

- **Profile initialization:** `src/services/userService.js`
- **Referral capture on signup:** `src/pages/SignupPage.jsx` + `src/services/authService.js`
- **Backend growth sync + reward granting:** `functions/index.js` (`syncStudentGrowth`)
- **Quote-time free-minute preview:** `functions/index.js` (`getPricingQuote`)
- **Session completion billing + minute deduction:** `functions/index.js` (`finalizeSessionBilling`)

## Pricing behavior

1. Original/base lesson value is still computed first using existing pricing engine.
2. Free-minute discount is applied proportionally.
3. Final payable student amount is reduced by discount.
4. Tutor payout remains based on original lesson value.

## Consumption behavior

- Minutes are deducted at session completion billing.
- Deduction amount is proportional to actual billed minutes.
- Repeated closure calls are protected by existing completed-status early return and single settlement write path.

## Deferred intentionally

- Promo codes
- Phone verification enforcement (only scaffolded in growth requirements)
- Advanced anti-fraud
- Tutor referral rewards
- Free-minute expirations
