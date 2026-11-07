import { useEffect, useState } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import { useAuth } from "../lib/auth";
import { field, type Ledger } from "../lib/field";
import { shortAddr, solFromLamports, useSolBalance } from "../lib/solana";

type Role = "org" | "contributor" | "reviewer";
const NOTES: Record<Role, string> = {
  org: "Funding a campaign and reclaiming unspent escrow are both signed from this wallet.",
  contributor: "Approved rewards are paid straight to this address.",
  reviewer: "Payments are released by signing a transaction from this wallet.",
};
const explorer = (kind: "address" | "tx", v: string) => `https://explorer.solana.com/${kind}/${v}?cluster=devnet`;
const sol = (l: number) => solFromLamports(l);
const link = "rounded-lg border border-border-low px-3 py-1.5 text-xs hover:bg-mint";

export default function WalletPage({ role }: { role: Role }) {
  const { wallet, disconnect } = useWalletConnection();
  const { token, signOut } = useAuth();
  const address = wallet?.account.address.toString();
  const balance = useSolBalance(address);
  const [copied, setCopied] = useState(false);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (token) field.ledger(token).then(setLedger).catch((e) => setError(String(e)));
  }, [token]);

  async function copy() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>

      <div className="space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Balance in your wallet</p>
          <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-brand">Solana Devnet</span>
        </div>
        <p className="text-4xl font-bold">
          {balance === null ? "…" : sol(balance).toFixed(4)} <span className="text-base font-medium text-muted">SOL</span>
        </p>
        <div className="space-y-2 border-t border-border-low pt-4">
          <p className="text-xs text-muted">Your address</p>
          <p className="break-all font-mono text-sm">{address}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={copy} className={link}>{copied ? "Copied" : "Copy address"}</button>
            {address && <a className={link} target="_blank" rel="noreferrer" href={explorer("address", address)}>View on Explorer</a>}
            <a className={link} target="_blank" rel="noreferrer" href="https://faucet.solana.com/">Get Devnet SOL</a>
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}

      {role === "contributor" && ledger && (
        <div className="space-y-3 rounded-2xl bg-brand-2 p-6 text-white shadow-sm">
          <p className="text-sm text-white/85">Earned on Solana</p>
          <p className="text-4xl font-bold">{sol(ledger.earned.total_lamports).toFixed(4)} <span className="text-base font-medium text-white/85">SOL</span></p>
          <p className="text-xs text-white/85">
            {ledger.earned.count} confirmed payment{ledger.earned.count === 1 ? "" : "s"}. Read from on-chain payment receipts, not from FieldMint's database.
          </p>
          {ledger.earned.receipts.length > 0 && (
            <ul className="divide-y divide-white/20 rounded-xl bg-white/10 text-sm">
              {ledger.earned.receipts.map((r) => (
                <li key={r.address} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span>{r.campaign_title}</span>
                  <span className="font-semibold">{sol(r.amount_lamports)} SOL</span>
                  <span className="text-xs text-white/80">{new Date(r.paid_at * 1000).toLocaleDateString()}</span>
                  <a className="text-xs underline" target="_blank" rel="noreferrer" href={explorer("address", r.address)}>receipt</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {role === "org" && ledger?.escrow && (
        <div className="space-y-3 rounded-2xl border border-border-low bg-card p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted">Held in escrow now</p><p className="text-2xl font-bold">{sol(ledger.escrow.held_lamports).toFixed(4)} SOL</p></div>
            <div><p className="text-xs text-muted">Paid to contributors</p><p className="text-2xl font-bold">{sol(ledger.escrow.paid_out_lamports).toFixed(4)} SOL</p></div>
          </div>
          <p className="text-xs text-muted">Escrow balances are read from the chain and include the small account deposit that is returned when you reclaim. Paid-out is from FieldMint records, each confirmed against an on-chain receipt.</p>
          {ledger.escrow.campaigns.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-mint p-3 text-sm">
              <span className="font-medium">{c.title}</span>
              <span>{sol(c.balance_lamports).toFixed(4)} SOL · {c.paid_count}/{c.max_payouts} paid</span>
              <a className="text-xs text-brand underline" target="_blank" rel="noreferrer" href={explorer("address", c.escrow)}>{shortAddr(c.escrow)}</a>
            </div>
          ))}
        </div>
      )}

      {role === "reviewer" && ledger?.released && (
        <div className="rounded-2xl border border-border-low bg-card p-6 shadow-sm">
          <p className="text-xs text-muted">Payments you released</p>
          <p className="text-2xl font-bold">{sol(ledger.released.total_lamports).toFixed(4)} SOL</p>
          <p className="text-xs text-muted">{ledger.released.count} payment{ledger.released.count === 1 ? "" : "s"}, each confirmed against an on-chain receipt before being recorded.</p>
        </div>
      )}

      <p className="text-sm text-muted">{NOTES[role]}</p>
      <button onClick={() => { signOut(); disconnect(); }}
        className="rounded-lg border border-border-low bg-card px-4 py-2 text-sm md:hidden">Sign out</button>
    </div>
  );
}