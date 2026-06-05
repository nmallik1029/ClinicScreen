/**
 * List ClinicScreen superadmins.
 *
 * Usage:
 *   npm run list-superadmins
 *
 * Targets whatever DATABASE_URL is in scope (.env by default; set the prod value
 * to list production superadmins).
 *
 * NOTE: passwords are stored only as one-way argon2 hashes in quickAuth and can
 * never be displayed. To set a known password for an account, use quickAuth's
 * `npm run reset-password -- <email>`.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: "SUPERADMIN" },
    orderBy: { createdAt: "asc" },
  });

  if (admins.length === 0) {
    console.log("No superadmins found.");
    return;
  }

  console.log(`\n${admins.length} superadmin(s):\n`);
  for (const a of admins) {
    console.log(`  • ${a.email}${a.disabledAt ? "   [DISABLED]" : ""}`);
    console.log(`      name:     ${a.preferredName ?? a.name}`);
    console.log(`      created:  ${a.createdAt.toISOString()}`);
    console.log("");
  }

  console.log("Passwords are stored only as argon2 hashes and cannot be shown.");
  console.log("To set a known password: (in quickAuth)  npm run reset-password -- <email>");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
