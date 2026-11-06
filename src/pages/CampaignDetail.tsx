import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useSolTransfer, useWalletSession } from "@solana/react-hooks";
import { api, type AppConfig, type Campaign } from "../lib/api";
import { useAuth } from "../lib/auth";
import { shortAddr, solFromLamports } from "../lib/solana";
import CampaignMap from "../components/CampaignMap";
import StatusChip from "../components/StatusChip";

const explorer = (kind: "tx" | "address", v: string) =>
  `https://explorer.solana.com/${kind}/${v}?cluster=devnet`;

export default function CampaignDetail() {
  const { id } = useParams();
  const session = useWalletSession();
  const wallet = session?.account.address.toString();
  const { token, signIn, signingIn } = useAuth();
  const { send } = useSolTransfer();

  const [c, setC] = useState<Campaign | null>(null);
  const [tasks, setTasks] = useState<GeoJSON.FeatureCollection>();
  const [cfg, setCfg] = useState<AppConfig>();
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingSig, setPendingSig] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getCampaign(id).then(setC).catch((e) => setError(String(e)));
    api.getTasks(id).then(setTasks).catch(() => {});
    api.config().then(setCfg).catch(() => {});
  }, [id]);

  if (error) return <p className="text-danger">{error}</p>;
  if (!c) return <p className="text-muted">Loading…</p>;

  const isOwner = !!wallet && wallet === c.owner_wallet;

  async function verify(signature: string) {
    setMsg("Confirming the payment on Solana…");
    const updated = await api.fundCampaign(c!.id, signature, token!);
    setC(updated);
    setPendingSig(null);
    setMsg("");
  }

  async function fund() {
    if (!cfg?.escrow || !token) return;
    setBusy(true);
    setError("");
    setMsg("Approve the transfer in your wallet…");
    try {
      const sig = String(await send({ amount: BigInt(c!.budget_lamports), destination: cfg.escrow }));
      setPendingSig(sig);
      await verify(sig);
    } catch (e) {
      setMsg("");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (!pendingSig) return;
    setBusy(true);
    setError("");
    try {
      await verify(pendingSig);
    } catch (e) {
      setMsg("");
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const stats: [string, string | number][] = [
    ["Sampling points", c.task_count],
    ["Reward / observation", `${solFromLamports(c.reward_lamports)} SOL`],
    ["Total budget", `${solFromLamports(c.budget_lamports)} SOL`],
    ["Target observations", c.target_observations],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
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

        {c.status === "draft" && isOwner && (
          <div className="text-right">
            {!token ? (
              <button onClick={signIn} disabled={signingIn}
                className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {signingIn ? "Check wallet…" : "Sign in to fund"}
              </button>
            ) : pendingSig ? (
              <button onClick={retry} disabled={busy}
                className="rounded-lg bg-amber px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-60">
                {busy ? "Verifying…" : "Retry verification"}
              </button>
            ) : (
              <button onClick={fund} disabled={busy || !cfg?.escrow}
                className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? "Working…" : `Fund ${solFromLamports(c.budget_lamports)} SOL on Devnet`}
              </button>
            )}
            {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border-low bg-card p-4 shadow-sm">
            <p className="text-xs text-muted">{k}</p>
            <p className="mt-1 text-lg font-semibold">{v}</p>
          </div>
        ))}
      </div>

      {c.funding_signature && cfg && (
        <div className="space-y-2 rounded-2xl border border-border-low bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="sol-chip">Funded on Solana</span>
            <span className="text-sm text-muted">Verified on-chain by FieldMint before the campaign went live.</span>
          </div>
          <p className="text-xs text-muted">
            Funding transaction:{" "}
            <a className="font-mono text-brand underline" target="_blank" rel="noreferrer"
              href={explorer("tx", c.funding_signature)}>{shortAddr(c.funding_signature)}</a>
            {" · "}Escrow:{" "}
            <a className="font-mono text-brand underline" target="_blank" rel="noreferrer"
              href={explorer("address", cfg.escrow)}>{shortAddr(cfg.escrow)}</a>
          </p>
        </div>
      )}

      <CampaignMap area={c.area} tasks={tasks} />
    </div>
  );
}