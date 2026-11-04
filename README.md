# Playwright Labs Certification Web

React 19 + TypeScript + Vite frontend for `certify.playwrightlabs.com`. It talks to the Spring Boot API in the separate `cert-api` repo.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173; /api/auth and /api/admin/users go to the auth service (8087), the rest to cert-api (8085)
```

Start the API first (see `cert-api/README.md`). Dev admin login: `admin@playwrightlabs.local` / `admin12345`.

```bash
npm run build      # type-check and build to dist/
npm run lint
```

## Run in Docker

The `Dockerfile` builds the app and serves it with Nginx, which proxies `/api` to the `api` container. The compose file that starts the whole stack (database, API, web) is in `playwrightlabs-cert-api`. See that README, or run from there:

```bash
docker compose --profile app up -d --build    # then open http://localhost:8088
```

## Pages

| Route | Who | Purpose |
|---|---|---|
| `/` | everyone | Exam overview and how it works |
| `/register`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password` | everyone | Account flows |
| `/verify`, `/verify/:certNo` | everyone | Public certificate verification (linked from the certificate's QR code) |
| `/dashboard` | candidate | Exam access, results, certificate downloads |
| `/start/:entitlementId` | candidate | Exam rules and consent, then starts the attempt |
| `/attempts/:id` | candidate | Timed exam (autosave, flags, question palette, auto-submit), then the result |
| `/admin/*` | admin | Exams, question bank and CSV import, grant access, attempts, certificates |

The session is an httpOnly cookie on the same origin, so the app never handles tokens. The colours match playwrightlabs.com (see `src/styles.css`).

## Deploy

On push to `main`, GitHub Actions builds and rsyncs `dist/` to `/var/www/certify` on the VPS. Nginx serves it and proxies `/api` to the API (see `cert-api/deploy/`). Required repo secrets: `VPS_SSH_KEY`, `VPS_HOST`. Deploys are skipped until the repo variable `DEPLOY_ENABLED` is `true`.
