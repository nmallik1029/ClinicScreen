import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClinicScreen",
  description: "Manage what plays on your office screens.",
};

const roleLabel: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  OFFICE_ADMIN: "Office admin",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="text-lg font-semibold text-blue-700">
              ClinicScreen
            </Link>
            <nav className="flex gap-4 text-sm text-slate-600">
              {user?.role === "SUPERADMIN" && (
                <Link href="/superadmin" className="hover:text-slate-900">
                  Superadmin
                </Link>
              )}
              {user?.practiceId && (
                <Link href={`/practices/${user.practiceId}`} className="hover:text-slate-900">
                  My practice
                </Link>
              )}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              {user ? (
                <>
                  <span className="text-slate-500">
                    {user.name} · {roleLabel[user.role] ?? user.role}
                  </span>
                  <form action="/auth/logout" method="post">
                    <button className="rounded border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/login"
                  className="rounded bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
