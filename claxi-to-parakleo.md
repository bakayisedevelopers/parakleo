Proposed Plan


  ## Claxi → Parakleo Full Rename Plan

  ### Summary

  Perform a full hard rename in coordinated phases so production remains stable while all brand and technical identifiers move from claxi to
  parakleo. This includes web, mobile, Firebase/GCP, Cloud Run services, secrets, package IDs, deep links, docs, and operational commands.
  Implementation starts by creating /workspaces/claxi/claxi-to-parakleo.md and tracking each phase checklist there.

  ### Implementation Changes (Step-by-step)

  1. Create migration control file and baseline inventory

  - Create claxi-to-parakleo.md in repo root with a checkbox tracker for all steps below.
  - Freeze a baseline by recording current values: Firebase project id (parakleo), Hosting site (claxi), Cloud Run service (claxi-paddle-
    ocr), Functions secret names (CLAXI_*), mobile package (com.anonymous.claximobile), deep link scheme (claxi), current domains/emails.
  - Add a “rollback references” section in the same file with old IDs/URLs for emergency restore.

  2. Branching and rollout safety

  - Create a dedicated rename branch.
  - Define cutover window and freeze unrelated deploys during migration.
  - Prepare parallel env values so old/new endpoints can be switched safely during verification.

  3. User-facing rename (low-risk first)

  - Replace visible UI text Claxi → Parakleo across web/mobile.
  - Update legal/policy/contact copy references (@claxi.app, brand mentions) only after confirming new email/domain targets.
  - Update app titles/metadata (web/index.html, app labels, README headings) and marketing/referral copy.

  4. Code/internal identifier rename

  - Rename internal storage keys, logger prefixes, constants, and identifiers (claxi_*, [claxi:*]) to parakleo_* / [parakleo:*].
  - Keep a temporary compatibility map for any persisted localStorage keys if continuity is required (read old key once, rewrite to new key,
    then deprecate).
  - Update JS bridge naming used in mobile session screens (ClaxiSessionBridge → ParakleoSessionBridge) in both producer/consumer code paths.

  5. Web/Firebase config migration

  - Update web env examples and active env files referencing Firebase project/auth/storage/function endpoints.
  - Update emulator target and cloud function endpoint URLs.
  - Update Firebase config files (firebase.json, .firebaserc) once target project/site names are finalized.
  - Validate all deployed endpoint URLs that currently include parakleo.

  6. Functions + secret contract migration

  - Rename secrets contract from CLAXI_* to PARAKLEO_* in functions code and secret-loading helpers.
  - Update every function binding that references the old secrets.
  - Migrate secret payload docs and operational commands to the new names.
  - Perform secret copy in cloud first (create new secrets with same values), then deploy code referencing new names, then retire old names
    after verification.

  7. Cloud Run / OCR service rename

  - Rename service/image identifiers (claxi-paddle-ocr*) to parakleo-paddle-ocr* in docs, deploy commands, and runtime references.
  - Update OCR service metadata (FastAPI title/service label) and any API key naming conventions tied to claxi.
  - Cut over function/env references to the new service URL only after health checks pass.

  8. Mobile app identity migration

  - Update Expo app metadata: name, slug, scheme (claxi:// → parakleo://).
  - Update Android app identity: rootProject.name, package/namespace (currently com.anonymous.claximobile) to new package path.
  - Move Android source directories to match the new package path and update Kotlin package declarations.
  - Update referral URLs currently using claxi.co.za to new domain.
  - Rebuild and reinstall app to validate deep links and auth/session flows.

  9. Package/repo metadata and docs cleanup

  - Rename package names (claxi, claxi-functions, claxi-mobile) where desired.
  - Update docs and runbooks (commands.txt, SECRETS.md, service READMEs) to only new naming.
  - Exclude historical logs/artifacts from forced rename unless they are active operational runbooks.

  10. Validation, cutover, and deprecation

  - Run web build/tests, functions lint/tests, mobile build.
  - Execute smoke tests: signup/login, request flow, session room (audio/screen share), payments, payout actions, OCR/classification endpoints.
  - Validate push/notification titles, email templates, and policy pages now show Parakleo.
  - After stable run period, remove temporary compatibility paths and retire old cloud resources/secrets.

  - Deep link scheme: claxi://... → parakleo://....
  - Mobile app package/namespace: current com.anonymous.claximobile to new package (final value to be chosen before implementation).
  - Firebase/Cloud endpoint hostnames and function URLs currently containing parakleo will change.
  - Cloud Run OCR service name and URL will change from claxi-paddle-ocr....
  - Secret names contract: CLAXI_PAYMENTS_SECRETS, CLAXI_EMAIL_SECRETS, CLAXI_REALTIME_SECRETS, CLAXI_AI_KEYS → PARAKLEO_* equivalents.
  - Storage/debug keys prefixed with claxi_ change to parakleo_ (with optional one-time migration for client continuity).

  ### Test Plan

  - Web: build + auth + request creation + tutor accept + live session + wallet/payment + legal pages brand text checks.
  - Functions: deploy dry validation + secret resolution checks + Paystack verify + OCR/classifier endpoints.
  - Mobile: app launch, login, referral share, deep link open, session room bridge/audio/share controls.
  - Infra: Firebase hosting deploy preview, Cloud Run health endpoint, function endpoint reachability from web/mobile envs.
  - Regression: ensure old persisted local data either migrates or is intentionally reset with user-facing notice.

  ### Assumptions and Defaults

  - Rename scope is full hard rename now (not phased branding-only).
  - Canonical new name is Parakleo.
  - Plan file name to create during implementation is claxi-to-parakleo.md.
  - Historical logs under .gcloud and non-operational archives are not rewritten unless they are used as active runbooks.