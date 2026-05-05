# Claxi Firebase Functions Secrets

Use grouped JSON secrets for Firebase Functions to reduce active Secret Manager version count while keeping related credentials together.

## CLAXI_PAYMENTS_SECRETS

```json
{
  "PAYSTACK_SECRET_KEY": "REPLACE_ME"
}
```

## CLAXI_EMAIL_SECRETS

```json
{
  "RESEND_API_KEY": "REPLACE_ME",
  "EMAIL_FROM": "REPLACE_ME"
}
```

## CLAXI_REALTIME_SECRETS

```json
{
  "CLOUDFLARE_TURN_KEY_ID": "REPLACE_ME",
  "CLOUDFLARE_TURN_API_TOKEN": "REPLACE_ME",
  "CLOUDFLARE_TURN_TTL_SECONDS": "600"
}
```

## CLAXI_AI_KEYS

```json
{
  "FIREBASE_API_KEY": "REPLACE_ME",
  "FIREBASE_AUTH_DOMAIN": "REPLACE_ME",
  "FIREBASE_PROJECT_ID": "REPLACE_ME",
  "FIREBASE_STORAGE_BUCKET": "REPLACE_ME",
  "FIREBASE_MESSAGING_SENDER_ID": "REPLACE_ME",
  "FIREBASE_APP_ID": "REPLACE_ME",
  "GEMINI_MODEL": "REPLACE_ME",
  "GEMINI_VISION_MODEL": "REPLACE_ME",
  "GEMINI_CLASSIFICATION_MODEL": "REPLACE_ME",
  "GEMINI_CLASSIFICATION_TIMEOUT_MS": "30000",
  "MAX_PDF_PAGES": "8"
}
```

This grouped secret is used by the Gemini-based student attachment extraction path and the tutor results extraction path.

During migration, the functions code still supports the old individual secrets as fallback values. Remove those fallback bindings only after the grouped secrets are deployed and verified in production.
