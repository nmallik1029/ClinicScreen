# Deploying ClinicScreen + quickAuth on Cloudflare Containers

This stack runs as **two Docker containers** on **Cloudflare Containers**, with
**Neon Postgres** for both databases and **Cloudflare R2** for media. argon2 and
Prisma run normally inside the containers (no edge port needed).

> Cloudflare Containers + `wrangler` evolve quickly. Treat the wrangler snippet
> below as a starting point and confirm field names against the current
> Cloudflare Containers docs when you deploy.

## 0. Prereqs
- Cloudflare account (you have one) + `npm i -g wrangler` and `wrangler login`.
- Docker installed locally (to build/push images).
- A Neon account (neon.tech) for Postgres.

## 1. Databases (Neon)
Create two Postgres databases (or two projects): `clinicscreen` and `quickauth`.
Copy each connection string (the pooled `...-pooler` URL is fine for app runtime).

**Both apps now use Postgres** (quickAuth was migrated off SQLite). For each, just
set `DATABASE_URL` to the matching Neon URL — the Dockerfile runs
`prisma migrate deploy` on boot to create the schema. No code changes needed.

For a fresh prod quickAuth you'll re-provision the client app + users there:
```bash
npm run create-client-app -- --name "ClinicScreen" --slug clinicscreen --redirect https://app.clinicscreen.com/auth/callback
npx tsx scripts/create-practice-admin.ts --email superadmin@clinicscreen.example --username superadmin --password "<temp>"
npx tsx scripts/set-client-branding.ts --slug clinicscreen --brandColor "#2563eb" --bgColor "#0b1e3b" --selfService false --contactEmail "<your email>"
```
(quickAuth's local dev DB is `postgresql://postgres:postgres@localhost:5432/quickauth`.)

## 2. Media storage (R2)
1. Create an R2 bucket, e.g. `clinicscreen-media`, and enable a public URL
   (r2.dev or a custom domain like `media.clinicscreen.com`).
2. Create an R2 API token (Object Read & Write).
3. Set these on the **ClinicScreen** container:
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
   `R2_PUBLIC_URL`. When set, uploads go to R2; when blank, local disk (dev only).

## 3. Build & deploy each container
Each app has a `Dockerfile` that builds the app, runs `prisma migrate deploy` on
boot, and serves on port **8080**.

Example `wrangler.jsonc` (per app) — verify against current docs:
```jsonc
{
  "name": "clinicscreen",
  "main": "worker.ts",
  "compatibility_date": "2025-01-01",
  "containers": [{ "class_name": "AppContainer", "image": "./Dockerfile", "instances": 1 }],
  "durable_objects": { "bindings": [{ "name": "APP", "class_name": "AppContainer" }] }
}
```
The Worker (`worker.ts`) forwards all requests to the container instance. Set env
vars/secrets with `wrangler secret put <NAME>` (DATABASE_URL, SESSION_SECRET,
QUICKAUTH_* , R2_*, and for quickAuth: PROVISION_SECRET, CLIENT_SECRET_PEPPER,
APP_URL, RESEND_API_KEY).

Deploy: `wrangler deploy` in each repo.

## 4. Domains
- `app.clinicscreen.com` → ClinicScreen worker
- `auth.clinicscreen.com` → quickAuth worker (set quickAuth `APP_URL` to this)
- Update the registered OAuth redirect URI to `https://app.clinicscreen.com/auth/callback`
  and ClinicScreen's `QUICKAUTH_URL` to `https://auth.clinicscreen.com`.

## 5. Email (Resend)
Set `RESEND_API_KEY` (+ `EMAIL_FROM`) on quickAuth so verification / password-reset
emails actually send (currently they only log to the console in dev).

## Required env summary
**ClinicScreen:** `DATABASE_URL`, `SESSION_SECRET`, `QUICKAUTH_URL`,
`QUICKAUTH_CLIENT_ID`, `QUICKAUTH_CLIENT_SECRET`, `QUICKAUTH_REDIRECT_URI`,
`QUICKAUTH_PROVISION_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.

**quickAuth:** `DATABASE_URL` (Postgres), `APP_URL`, `PROVISION_SECRET`,
`CLIENT_SECRET_PEPPER`, `RESEND_API_KEY`, `EMAIL_FROM`, `R2_*` (avatars, optional).
