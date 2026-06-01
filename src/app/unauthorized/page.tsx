import Link from "next/link";
import { Card } from "@/components/ui";

export default function UnauthorizedPage() {
  return (
    <div className="mx-auto max-w-md text-center">
      <Card>
        <h1 className="text-xl font-semibold">No access</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account doesn&apos;t have access to this page. If you think this is a mistake, contact
          your ClinicScreen administrator.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-blue-700">
          ← Back to home
        </Link>
      </Card>
    </div>
  );
}
