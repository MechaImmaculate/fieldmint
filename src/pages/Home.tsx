import { Link, Navigate } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";
import { useAuth } from "../lib/auth";

const cards = [
  { role: "org", to: "/org", title: "Organization", text: "Create and fund campaigns, then track results.", bar: "bg-brand" },
  { role: "reviewer", to: "/review", title: "Reviewer", text: "Check observations and release payments.", bar: "bg-ink" },
  { role: "contributor", to: "/contribute", title: "Contributor", text: "Find live campaigns and submit observations.", bar: "bg-brand-2" },
];

export default function Home() {
  const { status } = useWalletConnection();
  const { token, roles } = useAuth();

  if (status === "connecting") {
    return <div className="grid min-h-screen place-items-center text-muted">Connecting your wallet…</div>;
  }
  if (status !== "connected" || !token) return <Navigate to="/login" replace />;

  const available = cards.filter((c) => roles.includes(c.role));
  if (available.length === 1) return <Navigate to={available[0].to} replace />;

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-3xl space-y-6">
        <h1 className="text-center text-3xl font-bold tracking-tight">Continue as</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {available.map((c) => (
            <Link key={c.role} to={c.to}
              className="overflow-hidden rounded-2xl border border-border-low bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`h-2 ${c.bar}`} />
              <div className="p-5">
                <h2 className="font-semibold">{c.title}</h2>
                <p className="mt-2 text-sm text-muted">{c.text}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}