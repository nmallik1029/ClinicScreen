# ClinicScreen — local setup (Windows)

Get the app running locally so you can edit code, run it, and tweak things.

## What you need first

- **Windows** with **PowerShell** (built in).
- **PostgreSQL 17** — the app stores data here. Install from
  <https://www.postgresql.org/download/windows/>. During install you set a
  password for the `postgres` user — **remember it** (the setup script asks for it).
  The setup script can install this for you if it's missing.
- **Node.js 20+** — the setup script can install this for you too.

You do **not** need the quickAuth login server or any secrets. Login works via a
built-in **Developer sign-in** button for local development.

## Run it

1. Clone the repo and open a PowerShell window in the project folder.
2. Run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
   ```

   The script will: check Node + PostgreSQL, create the `carescreen` database,
   write a `.env`, install dependencies, apply the database schema, optionally load
   demo data, and start the app.

   > If it installs Node or PostgreSQL for you, it will ask you to **close the
   > window, open a new PowerShell, and run the command again** so the new tools
   > are on your PATH.

3. When it finishes, the app runs at **<http://localhost:3001>**.
4. Click **"Developer sign-in"** on the login page — you're in as a local admin.

## After the first time

You only run the setup script once. After that, just start the app:

```powershell
npm run dev
```

## Editing code

- Code lives under `src/`. Next.js hot-reloads most changes as you save.
- If you change `prisma/schema.prisma`, apply it with:

  ```powershell
  npx prisma migrate dev
  ```

## Optional: AI features

The doctor **website import** and **AI intro generation** call the Anthropic API.
They're off until you add your own key. Get one at
<https://console.anthropic.com>, then put it in `.env`:

```
ANTHROPIC_API_KEY="sk-ant-..."
```

Restart `npm run dev` after editing `.env`. Everything else works without a key.

## Troubleshooting

- **"Could not connect to Postgres"** — make sure the PostgreSQL service is running
  (Services app → `postgresql-x64-17`) and you entered the right password.
- **Login button does nothing / says quickAuth** — confirm `.env` has `DEV_LOGIN="1"`,
  then restart `npm run dev`.
- **Port 3001 in use** — stop whatever is using it, or change the port in
  `package.json` (the `dev` script).
