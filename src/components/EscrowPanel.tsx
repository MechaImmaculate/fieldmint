import { useCallback, useEffect, useState } from "react";
import { useSendTransaction, useWalletSession } from "@solana/react-hooks";
import { address } from "@solana/kit";
import { api, type AppConfig, type Campaign, type ChainState } from "../lib/api";
import { useAuth } from "../lib/auth";
import { closeIx, createCampaignIx, feeFor, payoutIx, sha256, totalFor } from "../lib/escrow";
import { shortAddr, solFromLamports } from "../lib/solana";

const explorer = (kind: "tx" | "address", v: string) =>
  `https://explorer.solana.com/${kind}/${v}?cluster=devnet`;
const DURATIONS: [string, number][] = [["1 hour (demo)", 3600], ["7 days", 604800], ["30 days", 2592000]];
const field = "w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm";
const btn = "rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60";

export default function EscrowPanel({ c, onChange }: { c: Campaign; onChange: (c: Campaign) => void }) {
  const session = useWalletSession();
  const wallet = session?.account.address.toString();
  const { token, signIn, signingIn } = useAuth();
  const { send } = useSendTransaction();

  const [cfg, setCfg] = useState<AppConfig>();
  const [chain, setChain] = useState<ChainState>();
  const [duration, setDuration] = useState(DURATIONS[1][1]);
  const [pending, setPending] = useState<{ signature: string; escrow: string } | null>(null);
  const [payTo, setPayTo] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const isOwner = !!wallet && wallet === c.owner_wallet;
  const funded = c.status !== "draft";

  const refresh = useCallback(() => {
    if (token) api.chain(c.id, token).then(setChain).catch(() => {});
  }, [c.id, token]);

  useEffect(() => { api.config().then(setCfg).catch(() => {}); }, []);
  useEffect(() => { if (funded) refresh(); }, [funded, refresh]);

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

  const reward = BigInt(c.reward_lamports);
  const feeTotal = cfg ? feeFor(reward, cfg.fee_bps) * BigInt(c.target_observations) : 0n;
  const total = cfg ? totalFor(reward, c.target_observations, cfg.fee_bps) : 0n;
  const sol = (l: bigint | number) => solFromLamports(Number(l));

  async function verify(p: { signature: string; escrow: string }) {
    onChange(await api.fundCampaign(c.id, p.signature, p.escrow, token!));
    setPending(null);
  }

  const fund = () => run("Approve the escrow transaction in your wallet…", async () => {
    if (!cfg || !wallet || !token) return;
    const { escrow, ix } = await createCampaignIx({
      programId: cfg.program_id, owner: wallet, campaignId: c.id, reward,
      maxPayouts: c.target_observations, feeBps: cfg.fee_bps,
      deadline: BigInt(Math.floor(Date.now() / 1000) + duration),
      reviewer: cfg.reviewer, treasury: cfg.treasury,
    });
    const signature = String(await send({ instructions: [ix], feePayer: wallet }));
    const p = { signature, escrow };
    setPending(p);
    setMsg("Confirming on-chain…");
    await verify(p);
  });

  const retry = () => run("Verifying…", async () => { if (pending) await verify(pending); });

  const pay = () => run("Approve the payout in your wallet…", async () => {
    if (!cfg || !wallet || !chain?.escrow) return;
    const contributor = address(payTo.trim());
    const submissionHash = await sha256(ref.trim());
    const ix = await payoutIx({
      programId: cfg.program_id, reviewer: wallet, escrow: chain.escrow,
      contributor, treasury: cfg.treasury, submissionHash,
    });
    await send({ instructions: [ix], feePayer: wallet });
    setPayTo("");
    setRef("");
    await new Promise((r) => setTimeout(r, 1500));
    refresh();
  });

  const reclaim = () => run("Approve in your wallet…", async () => {
    if (!cfg || !wallet || !token || !chain?.escrow) return;
    const signature = String(await send({
      instructions: [closeIx({ programId: cfg.program_id, owner: wallet, escrow: chain.escrow })],
      feePayer: wallet,
    }));
    setMsg("Confirming…");
    onChange(await api.closeCampaign(c.id, signature, token));
    refresh();
  });

  const now = Math.floor(Date.now() / 1000);
  const open = chain?.funded && !chain.closed;
  const canClose = !!open && isOwner &&
    (now >= (chain?.deadline ?? 0) || (chain?.paid_count ?? 0) >= (chain?.max_payouts ?? 1));
  const isReviewer = !!open && !!wallet && wallet === chain?.reviewer;

  return (
    <div className="space-y-4">
      {c.status === "draft" && (
        <div className="space-y-3 rounded-2xl border border-border-low bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Fund this campaign</h2>
          {!isOwner ? (
            <p className="text-sm text-muted">Waiting for the campaign owner to fund it.</p>
          ) : !token ? (
            <button className={btn} onClick={signIn} disabled={signingIn}>
              {signingIn ? "Check wallet…" : "Sign in to fund"}
            </button>
          ) : (
            <>
              <div className="grid gap-1 text-sm">
                <div className="flex justify-between"><span className="text-muted">Contributor rewards</span><span>{sol(reward * BigInt(c.target_observations))} SOL</span></div>
                <div className="flex justify-between"><span className="text-muted">FieldMint fee ({(cfg?.fee_bps ?? 0) / 100}%)</span><span>{sol(feeTotal)} SOL</span></div>
                <div className="flex justify-between border-t border-border-low pt-1 font-semibold"><span>Locked in escrow</span><span>{sol(total)} SOL</span></div>
              </div>
              <label className="block space-y-1 text-sm font-medium">Funds locked until
                <select className={field} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  {DURATIONS.map(([l, s]) => <option key={s} value={s}>{l}</option>)}
                </select>
              </label>
              <p className="text-xs text-muted">
                The money moves into a program-owned escrow account. You can reclaim what is unspent
                only after this deadline, or once every payout has been made.
              </p>
              {pending ? (
                <button className="rounded-lg bg-amber px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-60" onClick={retry} disabled={busy}>
                  {busy ? "Verifying…" : "Retry verification"}
                </button>
              ) : (
                <button className={btn} onClick={fund} disabled={busy || !cfg?.program_id}>
                  {busy ? "Working…" : `Lock ${sol(total)} SOL in escrow`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {funded && chain?.funded && (
        <div className="space-y-4 rounded-2xl border border-border-low bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="sol-chip">{chain.closed ? "Escrow closed" : "Locked in Solana escrow"}</span>
            <span className="text-xs text-muted">Read live from the chain, not from our database.</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-muted">Escrow balance</p><p className="font-semibold">{sol(chain.balance_lamports ?? 0)} SOL</p></div>
            <div><p className="text-xs text-muted">Payouts made</p><p className="font-semibold">{chain.paid_count} / {chain.max_payouts}</p></div>
            <div><p className="text-xs text-muted">Unlocks</p><p className="font-semibold">{chain.deadline ? new Date(chain.deadline * 1000).toLocaleString() : "—"}</p></div>
            <div><p className="text-xs text-muted">Reviewer</p><p className="font-mono text-xs">{chain.reviewer ? shortAddr(chain.reviewer) : "—"}</p></div>
          </div>
          <p className="text-xs text-muted">
            Escrow account:{" "}
            <a className="font-mono text-brand underline" target="_blank" rel="noreferrer" href={explorer("address", chain.escrow!)}>{shortAddr(chain.escrow!)}</a>
            {c.funding_signature && <>{" · "}Funding tx:{" "}
              <a className="font-mono text-brand underline" target="_blank" rel="noreferrer" href={explorer("tx", c.funding_signature)}>{shortAddr(c.funding_signature)}</a></>}
          </p>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Payment receipts</h3>
            {(chain.receipts ?? []).length === 0 ? (
              <p className="text-sm text-muted">No payments released yet.</p>
            ) : (
              <ul className="divide-y divide-border-low text-sm">
                {chain.receipts!.map((r) => (
                  <li key={r.address} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-mono text-xs">{shortAddr(r.contributor)}</span>
                    <span className="font-semibold">{sol(r.amount_lamports)} SOL</span>
                    <span className="font-mono text-xs text-muted">hash {r.submission_hash.slice(0, 10)}…</span>
                    <a className="text-xs text-brand underline" target="_blank" rel="noreferrer" href={explorer("address", r.address)}>receipt</a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isReviewer && (
            <div className="space-y-3 rounded-xl bg-mint p-4">
              <h3 className="text-sm font-semibold">Release a payment (reviewer)</h3>
              <input className={field} placeholder="Contributor wallet address" value={payTo} onChange={(e) => setPayTo(e.target.value)} />
              <input className={field} placeholder="Submission reference (hashed on-chain)" value={ref} onChange={(e) => setRef(e.target.value)} />
              <button className={btn} onClick={pay} disabled={busy || !payTo.trim() || !ref.trim()}>
                {busy ? "Working…" : `Pay ${sol(reward)} SOL`}
              </button>
              <p className="text-xs text-muted">Once the review queue exists, the Approve button does exactly this for a real submission.</p>
            </div>
          )}

          {isOwner && open && (
            canClose ? (
              <button className={btn} onClick={reclaim} disabled={busy}>Reclaim unspent funds</button>
            ) : (
              <p className="text-xs text-muted">Unspent funds can be reclaimed after the unlock time or when all payouts are made.</p>
            )
          )}
        </div>
      )}

      {msg && <p className="text-sm text-muted">{msg}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}