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

  const drafts = items?.filter((c) => c.status === "draft") ?? [];
  const live = items?.filter((c) => c.status === "active") ?? [];
  const stats: [string, string | number][] = [
    ["Campaigns", items?.length ?? 0],
    ["Live", live.length],
    ["Awaiting funding", drafts.length],
    ["Live reward budget", `${solFromLamports(live.reduce((s, c) => s + c.budget_lamports, 0))} SOL`],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-muted">Your campaigns, funding and results at a glance.</p>
      </div>

      {items && items.length === 0 && (
        <div className="rounded-2xl bg-brand p-6 text-white">
          <h2 className="text-lg font-semibold">Start your first campaign</h2>
          <p className="mt-1 text-sm text-white/80">Pick a county, set a reward, and FieldMint plans the sampling points.</p>
          <Link to="/org/campaigns/new" className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand">
            Create campaign
          </Link>
        </div>
      )}
      {drafts.length > 0 && (
        <div className="rounded-2xl border border-amber/40 bg-amber/10 p-5">
          <p className="font-semibold">{drafts.length} campaign{drafts.length > 1 ? "s" : ""} waiting to be funded</p>
          <Link to={`/org/campaigns/${drafts[0].id}`} className="text-sm text-brand underline">
            Fund "{drafts[0].title}"
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border-low bg-card p-4 shadow-sm">
            <p className="text-xs text-muted">{k}</p>
            <p className="mt-1 text-xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}

      {items && items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Latest campaigns</h2>
            <Link to="/org/campaigns" className="text-sm text-brand underline">View all</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.slice(0, 3).map((c) => <CampaignCard key={c.id} c={c} base="/org" />)}
          </div>
        </div>
      )}
    </div>
  );
}