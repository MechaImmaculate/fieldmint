import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Campaign } from "../lib/api";
import { useAuth } from "../lib/auth";
import { solFromLamports } from "../lib/solana";
import CampaignCard from "../components/CampaignCard";

export default function OrgDashboard() {
  const { token } = useAuth();
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.listCampaigns("org", token).then(setItems).catch((e) => setError(String(e)));
  }, [token]);

  const funded = items?.filter((c) => c.status !== "draft") ?? [];
  const stats: [string, string | number][] = [
    ["Campaigns", items?.length ?? 0],
    ["Funded and live", funded.length],
    ["Funded budget", `${solFromLamports(funded.reduce((s, c) => s + c.budget_lamports, 0))} SOL`],
    ["Observations targeted", funded.reduce((s, c) => s + c.target_observations, 0)],
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organization dashboard</h1>
          <p className="mt-1 text-muted">Your campaigns, funding and results.</p>
        </div>
        <Link to="/app/campaigns/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
          New campaign
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border-low bg-card p-4 shadow-sm">
            <p className="text-xs text-muted">{k}</p>
            <p className="mt-1 text-lg font-semibold">{v}</p>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {items?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border-strong p-10 text-center text-muted">
          No campaigns yet. Create your first one.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((c) => <CampaignCard key={c.id} c={c} />)}
      </div>
    </div>
  );
}