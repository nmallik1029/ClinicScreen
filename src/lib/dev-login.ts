// Local, dev-only sign-in bypass.
//
// When enabled, /auth/dev-login mints a session for a local SUPERADMIN without
// going through quickAuth — so a collaborator can clone the repo, run the setup
// script, and start editing immediately, with no auth server or secrets to share.
//
// Double-gated so it can never be reached in a real deployment: it requires a
// non-production build AND an explicit DEV_LOGIN=1 in the environment (which the
// setup script writes into the local .env and production never sets).

export const DEV_LOGIN_EMAIL = "dev@clinicscreen.local";

export function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "1";
}
