import { Link } from "react-router-dom";
import type { Campaign } from "../lib/api";
import { solFromLamports } from "../lib/solana";
import StatusChip from "./StatusChip";

export default function CampaignCard({ c, base }: { c: Campaign; base: string }) {
  return (
    <Link to={`${base}/campaigns/${c.id}`}
      className="rounded-2xl border border-border-low bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{c.region}</span>
        <StatusChip status={c.status} />
      </div>
      <h2 className="font-semibold">{c.title}</h2>
      <p className="mt-3 text-sm text-muted">
        {c.task_count} sampling points · {solFromLamports(c.reward_lamports)} SOL per observation
      </p>
    </Link>
  );
}