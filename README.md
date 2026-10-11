# QuoteLite

Quotes and invoices for a one-to-three person trade crew. Offline-first on the phone, synced through this Node server.

## Local development

Needs Node 22+.

```bash
cp .env.example .env.local
npm install
npm run start:e2e   # API on :8787
npm run dev         # Vite on :5173, proxies /api
```

```bash
npm run typecheck
npm run lint
npm run test:unit
npm test            # unit + production build + Playwright
```

## Docker Compose

One container serves the built app and the API. SQLite lives on a named volume.

```bash
cp .env.example .env
docker compose up --build -d
curl -fsS http://127.0.0.1:8787/api/health
```

HTTPS with Caddy (put your domain in `.env` as `SITE_ADDRESS` and set `COOKIE_SECURE=1`):

```bash
docker compose --profile tls up --build -d
```

Pull a published image instead of building:

```bash
export QUOTELITE_TAG=0.1.0
docker compose pull
docker compose up -d
```

Backup the database:

```bash
chmod +x deploy/backup.sh
./deploy/backup.sh
```

## Environment

Names only — values go in `.env` on the host, never in git.

| name | purpose |
| --- | --- |
| `PORT` | Listen port, default `8787` |
| `HOST` | Bind address, `0.0.0.0` in Docker |
| `DB_PATH` | SQLite file |
| `PUBLIC_BASE_URL` | Public origin for share links |
| `COOKIE_SECURE` | `1` when the app is served over HTTPS |
| `STRIPE_SECRET_KEY` | Crew Stripe secret. Live keys stay on the host |

## CI / CD and releases

- Pull requests and `main` run typecheck, lint, unit tests, and a production build. Playwright runs after that. `main` also publishes `ghcr.io/karthikmprakash/quotelite:<sha>` and `:main` for `linux/amd64` and `linux/arm64`.
- Tag a version to cut a GitHub Release and push `:x.y.z` plus `:latest`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Or run the **Release** workflow from the Actions tab.

The GHCR package must be public, or the host must `docker login ghcr.io` before `compose pull`.
