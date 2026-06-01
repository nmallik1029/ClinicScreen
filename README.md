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

The seed creates two users (sign in with quickAuth using these **exact emails**):

| Email | Role | Access |
|---|---|---|
| `superadmin@clinicscreen.example` | SUPERADMIN | All practices + Superadmin pages |
| `admin@testcardiology.example` | OFFICE_ADMIN | Only the Test Cardiology Clinic |

To add your own user: create the account in quickAuth, then add a matching `User`
row here (`npx prisma studio`) with the same email, the desired `role`, and a
`practiceId` for office admins.

## Seed data

One practice — **Test Cardiology Clinic** (Cardiology) — with a Main Office location,
three screens (Waiting Room, Exam Room 1, Hallway), four media items, and two
playlists assigned to two screens.

## Not included yet

Electron/kiosk app, real mini-PC logic, device heartbeat/remote commands, file
uploads/transcoding, EHR/patient data, analytics, and self-serve user invites. The
schema and UI are structured to add these later.
