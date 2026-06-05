/**
 * Delete a ClinicScreen SUPERADMIN (removes their ClinicScreen access).
 *
 * Usage:
 *   npm run delete-superadmin -- <email>
 *
 * Targets whatever DATABASE_URL is in scope (.env by default; set the prod value
 * to delete a production superadmin). Refuses to delete the last superadmin so you
 * can't lock yourself out. The quickAuth login is left intact (it just loses
 * ClinicScreen access) — remove it in quickAuth if you want it gone entirely.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run delete-superadmin -- <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "SUPERADMIN") {
    console.error(`No superadmin found with email "${email}".`);
    process.exit(1);
  }

  const total = await prisma.user.count({ where: { role: "SUPERADMIN" } });
  if (total <= 1) {
    console.error(
      "Refusing to delete the only superadmin — you'd lock yourself out.\n" +
        "Create another superadmin first (npm run create-superadmin), then delete this one.",
    );
    process.exit(1);
  }

  await prisma.user.delete({ where: { id: user.id } });
  console.log(`\n✅ Deleted superadmin ${user.email} from ClinicScreen.`);
  console.log("   Their quickAuth login still exists but no longer has ClinicScreen access.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
