import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";
import { api, type Region } from "../lib/api";
import { useAuth } from "../lib/auth";
import { lamportsFromSol } from "../lib/solana";

const field = "w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm";

export default function NewCampaign() {
  const nav = useNavigate();
  const { status } = useWalletConnection();
  const { token, roles, signIn, signingIn, error: authError } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [f, setF] = useState({ title: "", description: "", region: "Trans Nzoia", target: 50, reward: 0.01 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.regions().then(setRegions).catch(() => {});
  }, []);

  if (status !== "connected") {
    return <Gate title="Connect your wallet" text="Use the Connect wallet button in the header." />;
  }
  if (!token) {
    return (
      <Gate title="Sign in to continue" text="Sign a free message with your wallet to prove you own it.">
        <button onClick={signIn} disabled={signingIn}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {signingIn ? "Check your wallet…" : "Sign in with wallet"}
        </button>
        {authError && <p className="mt-2 text-sm text-danger">{authError}</p>}
      </Gate>
    );
  }
  if (!roles.includes("org")) {
    return <Gate title="Not authorized" text="This wallet is not on the organization allow-list, so it cannot create campaigns." />;
  }

  const budget = f.target * f.reward;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const c = await api.createCampaign({
        title: f.title,
        description: f.description,
        campaign_type: "crop_condition",
        region: f.region,
        reward_lamports: lamportsFromSol(f.reward),
        target_observations: f.target,
      }, token!);
      nav(`/org/campaigns/${c.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5 rounded-2xl border border-border-low bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-bold">New ground-truth campaign</h1>
      <p className="text-sm text-muted">Crop-condition observations. FieldMint generates the spatial sampling plan for you.</p>

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
          <select className={field} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>
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
      <p className="text-xs text-muted">{regions.find((r) => r.name === f.region)?.focus}</p>

      <div className="rounded-xl bg-mint p-4 text-sm">
        Total budget: <strong>{budget.toFixed(3)} SOL</strong> (Devnet). You fund it in the next step.
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button disabled={busy}
        className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "Creating…" : "Create campaign"}
      </button>
    </form>
  );
}

function Gate({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border-low bg-card p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mb-4 mt-2 text-sm text-muted">{text}</p>
      {children}
    </div>
  );
}