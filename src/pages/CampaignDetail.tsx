import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Campaign } from "../lib/api";
import { useAuth } from "../lib/auth";
import { shortAddr, solFromLamports } from "../lib/solana";
import CampaignMap from "../components/CampaignMap";
import EscrowPanel from "../components/EscrowPanel";
import StatusChip from "../components/StatusChip";
import SubmissionsPanel from "../components/SubmissionsPanel";

export default function CampaignDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const [c, setC] = useState<Campaign | null>(null);
  const [tasks, setTasks] = useState<GeoJSON.FeatureCollection>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id || !token) return;
    api.getCampaign(id, token).then(setC).catch((e) => setError(String(e)));
    api.getTasks(id, token).then(setTasks).catch(() => {});
  }, [id, token]);

  if (error) return <p className="text-danger">{error}</p>;
  if (!c) return <p className="text-muted">Loading…</p>;

  const stats: [string, string | number][] = [
    ["Sampling points", c.task_count],
    ["Reward / observation", `${solFromLamports(c.reward_lamports)} SOL`],
    ["Reward budget", `${solFromLamports(c.budget_lamports)} SOL`],
    ["Target observations", c.target_observations],
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {c.region} · {c.campaign_type.replace("_", " ")}
          </p>
          <StatusChip status={c.status} />
        </div>
        <h1 className="text-2xl font-bold">{c.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{c.description}</p>
        <p className="mt-2 font-mono text-xs text-muted">Owner {shortAddr(c.owner_wallet)}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border-low bg-card p-4 shadow-sm">
            <p className="text-xs text-muted">{k}</p>
            <p className="mt-1 text-lg font-semibold">{v}</p>
          </div>
        ))}
      </div>

      <EscrowPanel c={c} onChange={setC} />
      <SubmissionsPanel campaignId={c.id} />
      <CampaignMap area={c.area} tasks={tasks} />
    </div>
  );
}