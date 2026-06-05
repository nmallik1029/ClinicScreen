/**
 * Create (or promote) a ClinicScreen SUPERADMIN.
 *
 * A superadmin is a ClinicScreen User with role SUPERADMIN plus a matching
 * quickAuth login (same email). This script provisions the quickAuth login via
 * its server-to-server endpoint, then creates/promotes the ClinicScreen User.
 *
 * Usage:
 *   npm run create-superadmin -- <email> <username> [Full Name]
 *
 * Targets whatever DATABASE_URL / QUICKAUTH_URL / QUICKAUTH_PROVISION_SECRET your
 * .env points at. To create one on production, run it with the production values
 * for those three set in the environment.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Random password satisfying quickAuth strength (upper, lower, digit, 8+).
function tempPassword(): string {
  const rnd = crypto.randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
  return `Aa1${rnd}${crypto.randomInt(10, 99)}`;
}

async function upsertSuperadmin(email: string, name: string) {
  await prisma.user.upsert({
    where: { email },
    update: { role: "SUPERADMIN" },
    create: { email, name, role: "SUPERADMIN" },
  });
}

async function main() {
  const [emailArg, username, ...nameParts] = process.argv.slice(2);
  if (!emailArg || !username) {
    console.error('Usage: npm run create-superadmin -- <email> <username> ["Full Name"]');
    process.exit(1);
  }
  const email = emailArg.trim().toLowerCase();
  const name = nameParts.join(" ").trim() || username;

  const url = process.env.QUICKAUTH_URL;
  const secret = process.env.QUICKAUTH_PROVISION_SECRET;
  if (!url || !secret) {
    console.error("Missing QUICKAUTH_URL or QUICKAUTH_PROVISION_SECRET in the environment.");
    process.exit(1);
  }

  const password = tempPassword();
  const res = await fetch(`${url}/api/provision-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-provision-secret": secret },
    body: JSON.stringify({ email, username, password, name }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };

  if (res.ok) {
    await upsertSuperadmin(email, name);
    console.log(
      `\n✅ Superadmin created.\n   email:    ${email}\n   username: ${username}\n   TEMP PASSWORD: ${password}\n\nSign in, then change the password in quickAuth.`,
    );
    return;
  }

  if (body.error === "email_taken") {
    // quickAuth login already exists — just promote/link on the ClinicScreen side.
    await upsertSuperadmin(email, name);
    console.log(
      `\n✅ ${email} already had a quickAuth login — set as SUPERADMIN in ClinicScreen.\n   Sign in with the existing password (reset it in quickAuth if forgotten).`,
    );
    return;
  }

  const map: Record<string, string> = {
    username_taken: "That username is already taken in quickAuth.",
    unauthorized: "Provisioning secret mismatch (QUICKAUTH_PROVISION_SECRET).",
    missing_fields: "quickAuth rejected the request (missing fields).",
  };
  console.error(`\n❌ Could not provision the login: ${map[body.error ?? ""] ?? body.error ?? res.status}`);
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
