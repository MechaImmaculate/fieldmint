import { useEffect, useState } from "react";
import { useSendTransaction, useWalletSession } from "@solana/react-hooks";
import { api, type AppConfig } from "../lib/api";
import { useAuth } from "../lib/auth";
import { feeFor, payoutIx } from "../lib/escrow";
import { field, type Submission } from "../lib/field";
import { solFromLamports } from "../lib/solana";

const box = "w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm";
const btn = "rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60";
const sol = (l: bigint) => solFromLamports(Number(l));

type Props = { s: Submission; escrow: string | null; onChange: (s: Submission) => void };

export default function ReviewActions({ s, escrow, onChange }: Props) {
  const { token } = useAuth();
  const session = useWalletSession();
  const wallet = session?.account.address.toString();
  const { send } = useSendTransaction();
  const [cfg, setCfg] = useState<AppConfig>();
  const [reason, setReason] = useState("");
  const [pendingSig, setPendingSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { api.config().then(setCfg).catch(() => {}); }, []);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMsg(label);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMsg("");
      setBusy(false);
    }
  }

  const decide = (decision: "approved" | "rejected") =>
    run("Saving decision…", async () => {
      onChange(await field.review(s.id, { decision, reason }, token!));
    });

  const pay = () => run("Approve the payout in your wallet…", async () => {
    if (!cfg || !wallet || !escrow || !token) throw new Error("Escrow details are still loading, try again");
    const hash = Uint8Array.from(s.record_hash.match(/../g)!.map((h) => parseInt(h, 16)));
    const ix = await payoutIx({
      programId: cfg.program_id, reviewer: wallet, escrow,
      contributor: s.contributor_wallet, treasury: cfg.treasury, submissionHash: hash,
    });
    const signature = String(await send({ instructions: [ix], feePayer: wallet }));
    setPendingSig(signature);
    setMsg("Confirming on-chain…");
    onChange(await field.confirmPayment(s.id, signature, token));
    setPendingSig(null);
  });

  const check = () => run("Checking the chain…", async () => {
    onChange(await field.confirmPayment(s.id, pendingSig, token!));
    setPendingSig(null);
  });

  const reward = BigInt(s.reward_lamports);
  const fee = cfg ? feeFor(reward, cfg.fee_bps) : 0n;

  return (
    <section className="space-y-3 rounded-2xl border-2 border-ink/10 bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Reviewer decision</h3>

      {s.status === "submitted" && (
        <>
          <textarea rows={2} className={box} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Decision note (required if you reject)" />
          <div className="flex flex-wrap gap-3">
            <button className={`${btn} bg-brand`} onClick={() => decide("approved")} disabled={busy}>Approve</button>
            <button className={`${btn} bg-danger`} onClick={() => decide("rejected")} disabled={busy}>Reject</button>
          </div>
          <p className="text-xs text-muted">A flagged check is not a rejection. You can approve with flags if the evidence holds up.</p>
        </>
      )}

      {s.status === "approved" && (
        <>
          <p className="text-sm">
            Approved. Releasing <b>{sol(reward)} SOL</b> to the contributor, plus a {sol(fee)} SOL platform fee, both from the escrow.
          </p>
          <div className="flex flex-wrap gap-3">
            <button className={`${btn} bg-brand`} onClick={pendingSig ? check : pay} disabled={busy || !escrow}>
              {pendingSig ? "Retry confirmation" : `Release ${sol(reward)} SOL`}
            </button>
            <button className="rounded-lg border border-border-low px-4 py-2.5 text-sm" onClick={check} disabled={busy}>
              Check payment status
            </button>
          </div>
          <p className="text-xs text-muted">
            You sign one transaction. The escrow pays the contributor and the treasury and writes a receipt tied to this submission's fingerprint. Paying the same submission twice is impossible.
          </p>
        </>
      )}

      {s.status === "rejected" && <p className="text-sm text-muted">Rejected. The contributor can see your note.</p>}
      {s.status === "paid" && <p className="text-sm text-brand">Paid and confirmed on Solana.</p>}
      {msg && <p className="text-sm text-muted">{msg}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}