import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Campaign } from "../lib/api";
import { shortAddr, solFromLamports } from "../lib/solana";
import CampaignMap from "../components/CampaignMap";

export default function CampaignDetail() {
  const { id } = useParams();
  const [c, setC] = useState<Campaign | null>(null);
  const [tasks, setTasks] = useState<GeoJSON.FeatureCollection>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api.getCampaign(id).then(setC).catch((e) => setError(String(e)));
    api.getTasks(id).then(setTasks).catch(() => {});
  }, [id]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!c) return <p className="text-muted">Loading…</p>;

  const stats = [
    ["Sampling points", c.task_count],
    ["Reward / observation", `${solFromLamports(c.reward_lamports)} SOL`],
    ["Total budget", `${solFromLamports(c.budget_lamports)} SOL`],
    ["Status", c.status],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{c.region} · {c.campaign_type.replace("_", " ")}</p>
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{c.description}</p>
          <p className="mt-2 font-mono text-xs text-muted">Owner {shortAddr(c.owner_wallet)}</p>
        </div>
        <button disabled title="Funding arrives in the next section"
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-bg1 opacity-50">
          Fund on Devnet (next)
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k as string} className="rounded-xl border border-border-low bg-card p-4">
            <p className="text-xs text-muted">{k}</p>
            <p className="mt-1 font-semibold capitalize">{v}</p>
          </div>
        ))}
      </div>
      <CampaignMap area={c.area} tasks={tasks} />
    </div>
  );
}