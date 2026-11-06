import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Campaign } from "../lib/api";
import { useAuth } from "../lib/auth";
import { solFromLamports } from "../lib/solana";
import StatusChip from "../components/StatusChip";

export default function Campaigns() {
  const { roles } = useAuth();
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listCampaigns().then(setItems).catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-muted">Ground-truth collection campaigns and their funding status.</p>
        </div>
        {roles.includes("org") && (
          <Link to="/campaigns/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            New campaign
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-danger">API unreachable: {error}</p>}
      {items?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border-strong p-10 text-center text-muted">
          No campaigns yet.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((c) => (
          <Link key={c.id} to={`/campaigns/${c.id}`}
            className="rounded-2xl border border-border-low bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">{c.region}</span>
              <StatusChip status={c.status} />
            </div>
            <h2 className="font-semibold">{c.title}</h2>
            <p className="mt-3 text-sm text-muted">
              {c.task_count} sampling points · {solFromLamports(c.budget_lamports)} SOL budget
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}