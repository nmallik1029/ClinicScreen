import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import ThemeToggle from "@/components/ThemeToggle";
import Walkthrough from "@/components/Walkthrough";
import "./globals.css";

// Applies the saved (or system) theme before first paint to avoid a flash of
// the wrong mode. Kept inline + minimal because it must run before hydration.
const noFlashTheme = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

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
  const headerUser = user
    ? {
        name: user.name,
        roleLabel: roleLabel[user.role] ?? user.role,
        isSuperadmin: user.role === "SUPERADMIN",
      }
    : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body>
        <AppHeader user={headerUser} />
        <main className="w-full px-6 py-8">{children}</main>
        <ThemeToggle />
        <Suspense fallback={null}>
          <Walkthrough />
        </Suspense>
      </body>
    </html>
  );
}
