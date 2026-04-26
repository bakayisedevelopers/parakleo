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

During migration, the functions code still supports the old individual secrets as fallback values. Remove those fallback bindings only after the grouped secrets are deployed and verified in production.
