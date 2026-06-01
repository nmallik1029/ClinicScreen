import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 ${props.className ?? ""}`}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-600">{children}</label>;
}

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    ghost: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  }[variant];
  return (
    <button
      {...props}
      className={`rounded px-3 py-2 text-sm font-medium transition ${styles} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: "ONLINE" | "OFFLINE" | "UNKNOWN" }) {
  const map = {
    ONLINE: "bg-green-100 text-green-700",
    OFFLINE: "bg-slate-200 text-slate-600",
    UNKNOWN: "bg-amber-100 text-amber-700",
  };
  const label = { ONLINE: "Online", OFFLINE: "Offline", UNKNOWN: "Unknown" };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {label[status]}
    </span>
  );
}

export function Tabs({ practiceId, active }: { practiceId: string; active: string }) {
  const tabs = [
    { href: "", label: "Overview" },
    { href: "/screens", label: "Screens" },
    { href: "/locations", label: "Locations" },
    { href: "/media", label: "Media" },
    { href: "/playlists", label: "Playlists" },
  ];
  return (
    <nav className="mb-6 flex gap-1 border-b">
      {tabs.map((t) => {
        const isActive = active === t.label;
        return (
          <Link
            key={t.label}
            href={`/practices/${practiceId}${t.href}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              isActive
                ? "border-blue-600 font-medium text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
