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
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
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

type TabMetric = {
  value: number | string;
  note?: string;
};

export function Tabs({
  practiceId,
  active,
  metrics = {},
}: {
  practiceId: string;
  active: string;
  metrics?: Partial<Record<string, TabMetric>>;
}) {
  const tabs = [
    { href: "", label: "Overview", summary: "Health, gaps, and next moves" },
    { href: "/screens", label: "Screens", summary: "Players, pairing, assignments" },
    { href: "/locations", label: "Locations", summary: "Offices and screen grouping" },
    { href: "/media", label: "Media", summary: "Uploaded images and videos" },
    { href: "/playlists", label: "Playlists", summary: "Loops scheduled to screens" },
  ];
  return (
    <nav className="mb-6 grid gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
      {tabs.map((t) => {
        const isActive = active === t.label;
        const metric = metrics[t.label];
        return (
          <Link
            key={t.label}
            href={`/practices/${practiceId}${t.href}`}
            prefetch
            className={`group relative overflow-hidden rounded-md border px-3 py-3 text-left transition duration-200 ${
              isActive
                ? "border-blue-200 bg-blue-50 text-blue-950 shadow-sm"
                : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <span
              className={`absolute inset-x-3 top-0 h-0.5 rounded-full transition ${
                isActive ? "bg-blue-600 opacity-100" : "bg-slate-300 opacity-0 group-hover:opacity-100"
              }`}
            />
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className={`mt-1 block text-xs ${isActive ? "text-blue-700" : "text-slate-500"}`}>
                  {t.summary}
                </span>
              </span>
              {metric ? (
                <span
                  className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
                    isActive ? "bg-white text-blue-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {metric.value}
                </span>
              ) : null}
            </span>
            {metric?.note ? (
              <span className={`mt-2 block text-xs ${isActive ? "text-blue-700" : "text-slate-400"}`}>
                {metric.note}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
