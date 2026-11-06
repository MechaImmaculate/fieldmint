import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";
import { api, type Region } from "../lib/api";
import { lamportsFromSol } from "../lib/solana";

const field = "w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm";

export default function NewCampaign() {
  const nav = useNavigate();
  const { wallet, status } = useWalletConnection();
  const owner = wallet?.account.address.toString();
  const [regions, setRegions] = useState<Region[]>([]);
  const [f, setF] = useState({
    title: "", description: "", region: "Trans Nzoia", target: 50, reward: 0.01,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.regions().then(setRegions).catch(() => {});
  }, []);

  const budget = f.target * f.reward;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!owner) return;
    setBusy(true);
    setError("");
    try {
      const c = await api.createCampaign({
        title: f.title,
        description: f.description,
        campaign_type: "crop_condition",
        region: f.region,
        owner_wallet: owner,
        reward_lamports: lamportsFromSol(f.reward),
        target_observations: f.target,
      });
      nav(`/campaigns/${c.id}`);
    } catch (err) {
      setError(String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-semibold">New ground-truth campaign</h1>
      <p className="text-sm text-muted">
        Crop-condition observations. FieldMint generates the spatial sampling plan for you.
      </p>

      <label className="block space-y-1 text-sm font-medium">Title
        <input required minLength={3} className={field} value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          placeholder="Maize condition, Trans Nzoia long rains" />
      </label>
      <label className="block space-y-1 text-sm font-medium">Instructions for contributors
        <textarea rows={3} className={field} value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
          placeholder="Photograph the crop, record growth stage and visible stress." />
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label className="space-y-1 text-sm font-medium">County
          <select className={field} value={f.region}
            onChange={(e) => setF({ ...f, region: e.target.value })}>
            {regions.map((r) => <option key={r.name}>{r.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">Observations
          <input type="number" min={1} max={2000} className={field} value={f.target}
            onChange={(e) => setF({ ...f, target: Number(e.target.value) })} />
        </label>
        <label className="space-y-1 text-sm font-medium">Reward (SOL)
          <input type="number" step="0.001" min={0.001} className={field} value={f.reward}
            onChange={(e) => setF({ ...f, reward: Number(e.target.value) })} />
        </label>
      </div>
      <p className="text-xs text-muted">
        {regions.find((r) => r.name === f.region)?.focus}
      </p>

      <div className="rounded-xl bg-cream p-4 text-sm">
        Total budget: <strong>{budget.toFixed(3)} SOL</strong> (Devnet)
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={busy || status !== "connected"}
        className="w-full rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-bg1 disabled:opacity-50">
        {status !== "connected" ? "Connect your wallet to continue" : busy ? "Creating…" : "Create campaign"}
      </button>
    </form>
  );
}