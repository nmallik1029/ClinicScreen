# ClinicScreen (MVP)

Web app foundation for managing medical office display screens. Practices manage
**Screens** (devices), locations, media, and playlists from a simple dashboard. A
browser-based test player simulates what a screen would show.

> This MVP handles **generic office display content only**. It does not collect or
> store any patient information.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM + PostgreSQL
- Server actions for all mutations

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure the database**

   Copy `.env.example` to `.env` and set a PostgreSQL connection string:

   ```bash
   cp .env.example .env
   # then edit DATABASE_URL
   ```

   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/carescreen?schema=public"
   ```

   > The local dev database is named **carescreen**. Keep this name unless you also
   > rename the database in Postgres.

   Set a `SESSION_SECRET` (any long random string) and your quickAuth client
   credentials — see **Authentication & test users** below for how to obtain them.

3. **Run the migration** (creates tables)

   ```bash
   npx prisma migrate dev --name init
   ```

4. **Seed sample data**

   ```bash
   npm run db:seed
   ```

5. **Start the dev server**

   ```bash
   npm run dev
   ```

## Using the app

ClinicScreen runs on **<http://localhost:3001>** (quickAuth uses :3000).

- **Sign in:** open <http://localhost:3001>. Anonymous visitors are sent to `/login`,
  which redirects to quickAuth. After authorizing, you're routed by role —
  superadmins to the Superadmin view, office admins to their own practice dashboard.
- **Dashboard:** Superadmins list/create practices and can open any practice. Each
  practice dashboard has Overview, Screens, Locations, Media, and Playlists tabs.
- **Test player:** open `http://localhost:3001/player/<screenId>` (no sign-in
  required for now — device auth comes later). Find a screen's player link on the
  **Screens** page ("Open player ↗"). It loops the assigned playlist, or shows
  "No playlist assigned".

## Authentication & test users

Auth is delegated to [quickAuth](https://github.com/nmallik1029/quickAuth) via OAuth
(authorization-code flow). quickAuth is the identity provider; ClinicScreen exchanges
the code for the user's profile, then links the returned **email** to a Prisma `User`
row, which carries the role and (for office admins) the practice. After login,
ClinicScreen sets its own signed, HTTP-only session cookie (`SESSION_SECRET`).

**One-time setup:**

1. Clone and run quickAuth (defaults to :3000): `npm install && npx prisma migrate dev && npm run dev`.
2. Register ClinicScreen as a client app **in the quickAuth repo**:
   ```bash
   npm run create-client-app -- \
     --name "ClinicScreen" --slug clinicscreen \
     --redirect http://localhost:3001/auth/callback
   ```
   Put the printed `client_id` / `client_secret` into ClinicScreen's `.env`
   (`QUICKAUTH_CLIENT_ID`, `QUICKAUTH_CLIENT_SECRET`), with
   `QUICKAUTH_URL=http://localhost:3000` and
   `QUICKAUTH_REDIRECT_URI=http://localhost:3001/auth/callback`.

The seed creates these users (sign in with quickAuth using these **exact emails**):

| Email | Role | Access |
|---|---|---|
| `superadmin@clinicscreen.example` | SUPERADMIN | All practices + Superadmin pages |
| `admin@testcardiology.example` | OFFICE_ADMIN | Only the Test Cardiology Clinic |
| `neel@testcardiology.example` | OFFICE_ADMIN | Only the Test Cardiology Clinic |

### Multiple admins per practice & first-login onboarding

A practice can have many admins — each gets their **own** login (no shared
credentials). To onboard a person:

1. **Create their quickAuth account with a temp password** (in the quickAuth repo):
   ```bash
   npx tsx scripts/create-practice-admin.ts \
     --email neel@testcardiology.example --username neelmallik \
     --password "Temp1234!" --name "Neel Mallik"
   ```
   This marks the account "must change password".
2. **Add a matching ClinicScreen `User` row** (same email, `role`, `practiceId`).

On first login (office admins only), the user is sent to **`/onboarding`** and must
**set a new password** (changed in quickAuth via a token-authenticated
`POST /oauth/change-password`) and **choose a preferred name** before they can use the
app. Their username stays the same; only the password changes. The preferred name is
shown in the dashboard greeting ("Good morning/afternoon/evening, &lt;name&gt;").
Superadmins skip onboarding.

## Media uploads

Media is uploaded as real files (no more pasted URLs).

- **Where files are stored:** `public/uploads/<practiceId>/` (git-ignored). They are
  served by Next.js at `/uploads/<practiceId>/<file>`, which the dashboard and the
  player both use. This local storage is intentionally swappable for Cloudflare R2 later.
- **Allowed types:** images `jpg`, `jpeg`, `png`, `webp`; videos `mp4`, `webm`.
  Anything else is rejected with a clear message.
- **Size limits:** images max **10 MB**, videos max **100 MB**.

**Test upload → playlist → player:**
1. Sign in, open a practice → **Media** → upload an image or video (give it a title).
2. It appears in the media list with a thumbnail/preview.
3. Go to **Playlists**, open a playlist, add the uploaded media.
4. Go to **Screens**, assign that playlist to a screen.
5. Open the screen's **player** link (`/player/<screenId>`) — the uploaded media
   displays/plays.

## Screens are paired with a per-device token

Each screen has a secret `token`. The player URL is `/player/<screenId>?t=<token>`, and
the heartbeat/command APIs require it — so screens (and their playlists/commands) can't
be viewed or driven by guessing an ID. The dashboard's **Open player ↗** link includes
the token; **Reset link** rotates it (invalidating the old URL). New screens get a token
automatically. (Device-token auth replaces the previously-open player routes.)

## Admins, sessions & offboarding

- **Add an admin from the dashboard:** on a practice's superadmin page, **Add admin**
  provisions a quickAuth login (temp password, must-change-on-first-login) *and* the
  ClinicScreen user in one step, showing the temp password once. Requires
  `QUICKAUTH_PROVISION_SECRET` (ClinicScreen) to match `PROVISION_SECRET` (quickAuth).
- **Disable / enable** an admin from the same page; disabling cuts their access
  immediately and revokes active sessions.
- **Sessions** are signed, expiring (7 days), and revocable: a disabled user or one whose
  sessions were revoked is rejected on the next request even with a valid cookie.

## Screens: heartbeat, status & refresh

The browser player behaves like a real display device:

- **Heartbeat:** an open `/player/<screenId>` posts to
  `POST /api/player/<id>/heartbeat` every 30s, updating the screen's `lastSeenAt`
  (and `softwareVersion = "browser-dev"`). Heartbeat failures never interrupt playback.
- **Online/offline:** status is **computed** from `lastSeenAt` — **Online** if seen
  within the last 2 minutes, otherwise **Offline**. No background job; a screen goes
  Offline on its own once heartbeats stop. Shown on the Screens, Overview, and
  Superadmin pages.
- **Refresh command:** "Refresh screen" on the Screens page creates a `PENDING`
  `DeviceCommand` (RBAC-enforced: office admins only for their own practice). The
  player polls `GET /api/player/<id>/commands` every ~12s, and on a `REFRESH` it
  refetches its playlist and marks the command complete via
  `POST /api/player/<id>/commands/<commandId>/complete`. Recent commands are listed
  under each screen.

> The `/player/*` and `/api/player/*` routes are intentionally **unauthenticated** in
> dev. Per-device token auth is a later step.

**Test it:** open a screen's player → it shows **Online** within 30s and its last-seen
updates; close the tab → it shows **Offline** after ~2 min. Click **Refresh screen**
(a `PENDING` command appears) → the open player picks it up within ~12s, reloads its
playlist, and the command flips to **Completed**.

## Seed data

One practice — **Test Cardiology Clinic** (Cardiology) — with a Main Office location,
three screens (Waiting Room, Exam Room 1, Hallway), four media items, and two
playlists assigned to two screens.

## Not included yet

Electron/kiosk app, real mini-PC logic, device heartbeat/remote commands, file
uploads/transcoding, EHR/patient data, analytics, and self-serve user invites. The
schema and UI are structured to add these later.
