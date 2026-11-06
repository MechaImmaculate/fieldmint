import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

const cards = [
  { role: "org", to: "/app/org", title: "Organization", text: "Create and fund campaigns, then track verified results." },
  { role: "reviewer", to: "/app/review", title: "Review", text: "Check submitted observations and approve payments." },
  { role: "contributor", to: "/app/contribute", title: "Contribute", text: "Find live campaigns and submit field observations." },
];

export default function Home() {
  const { roles } = useAuth();
  const available = cards.filter((c) => roles.includes(c.role));
  if (available.length === 1) return <Navigate to={available[0].to} replace />;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Choose a dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {available.map((c) => (
          <Link key={c.role} to={c.to}
            className="rounded-2xl border border-border-low bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <h2 className="text-lg font-semibold text-brand">{c.title}</h2>
            <p className="mt-2 text-sm text-muted">{c.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}