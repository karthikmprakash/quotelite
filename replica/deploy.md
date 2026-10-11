# Deploy

Date: 2026-10-11  Go from user: infrastructure only (not live on a public domain)

## Host

Docker Compose on a VPS you control. Image: `ghcr.io/karthikmprakash/quotelite`. Data: named volume `quotelite-data`. Optional Caddy profile for TLS.

## Environment

Match `.env.example`. The operator pastes live Stripe keys into `.env` on the host. This file does not contain values.

## Watch

- Health: `GET /api/health`
- Backups: `deploy/backup.sh`
- CI: `.github/workflows/ci.yml`
- Releases: tag `v*` or the Release workflow

## Still on the operator

- Buy the domain and point DNS
- Set `SITE_ADDRESS`, `ACME_EMAIL`, `COOKIE_SECURE=1`, `PUBLIC_BASE_URL`
- Stripe live mode and a test charge
- Make the GHCR package public or log the host into ghcr.io
