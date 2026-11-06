import { useEffect, useState } from "react";
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Verification dashboard</h1>
        <p className="mt-1 text-muted">Review submitted observations, then approve or reject them. Approval triggers payment.</p>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <section className="rounded-2xl border border-border-low bg-card p-6 shadow-sm">
        <h2 className="font-semibold">Review queue</h2>
        <p className="mt-2 text-sm text-muted">
          No submissions to review yet. Contributor submissions will appear here with their evidence,
          location and quality flags.
        </p>
      </section>
      <div>
        <h2 className="mb-3 font-semibold">Live campaigns</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => <CampaignCard key={c.id} c={c} />)}
        </div>
      </div>
    </div>
  );
}