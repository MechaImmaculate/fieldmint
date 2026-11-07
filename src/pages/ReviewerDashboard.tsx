import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Campaign } from "../lib/api";
import { useAuth } from "../lib/auth";
import CampaignCard from "../components/CampaignCard";

export default function ReviewerDashboard() {
  const { token } = useAuth();
  const [items, setItems] = useState<Campaign[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.listCampaigns("review", token).then(setItems).catch((e) => setError(String(e)));
  }, [token]);

  const stats: [string, number][] = [
    ["Awaiting review", 0],
    ["Flagged by AI", 0],
    ["Approved", 0],
    ["Live campaigns", items.length],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review queue</h1>
        <p className="mt-1 text-muted">Check each observation, then approve or reject. Approval releases payment.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border-low bg-card p-4 shadow-sm">
            <p className="text-xs text-muted">{k}</p>
            <p className="mt-1 text-xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <section className="rounded-2xl border border-border-low bg-card p-6 shadow-sm">
        <h2 className="font-semibold">Submissions to review</h2>
        <p className="mt-2 text-sm text-muted">
          Nothing to review yet. Contributor submissions will appear here with their map location,
          photo and quality flags.
        </p>
      </section>
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Live campaigns</h2>
            <Link to="/review/campaigns" className="text-sm text-brand underline">View all</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.slice(0, 3).map((c) => <CampaignCard key={c.id} c={c} base="/review" />)}
          </div>
        </div>
      )}
    </div>
  );
}