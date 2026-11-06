import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Campaign } from "../lib/api";
import { solFromLamports } from "../lib/solana";

export default function Campaigns() {
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listCampaigns().then(setItems).catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm uppercase tracking-[0.18em] text-muted">Ground-truth infrastructure</p>
        <h1 className="text-3xl font-semibold tracking-tight">Verified field data, paid on Solana.</h1>
        <p className="max-w-2xl text-muted">
          Commission agricultural and Earth Observation ground-truth campaigns across Kenya.
        </p>
      </section>

      {error && <p className="text-sm text-red-600">API unreachable: {error}</p>}
      {items?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border-low p-10 text-center">
          <p className="mb-4 text-muted">No campaigns yet.</p>
          <Link to="/campaigns/new" className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-bg1">
            Create the first campaign
          </Link>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {items?.map((c) => (
          <Link key={c.id} to={`/campaigns/${c.id}`} className="rounded-2xl border border-border-low bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted">{c.region}</span>
              <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-semibold capitalize">{c.status}</span>
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