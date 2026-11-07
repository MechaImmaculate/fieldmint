import { useState } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import { useAuth } from "../lib/auth";
import { solFromLamports, useSolBalance } from "../lib/solana";

const NOTES = {
  org: "Funding a campaign and reclaiming unspent escrow are both signed from this wallet.",
  contributor: "Approved rewards are paid straight to this address. Your earnings will be listed here once payouts start.",
  reviewer: "Payments are released by signing a transaction from this wallet.",
};

export default function WalletPage({ role }: { role: keyof typeof NOTES }) {
  const { wallet, disconnect } = useWalletConnection();
  const { signOut } = useAuth();
  const address = wallet?.account.address.toString();
  const balance = useSolBalance(address);
  const [copied, setCopied] = useState(false);

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
          <p className="text-sm text-muted">Balance</p>
          <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-brand">Solana Devnet</span>
        </div>
        <p className="text-4xl font-bold">
          {balance === null ? "…" : solFromLamports(balance).toFixed(4)}{" "}
          <span className="text-base font-medium text-muted">SOL</span>
        </p>
        <div className="space-y-2 border-t border-border-low pt-4">
          <p className="text-xs text-muted">Your address</p>
          <p className="break-all font-mono text-sm">{address}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={copy} className="rounded-lg border border-border-low px-3 py-1.5 text-xs hover:bg-mint">
              {copied ? "Copied" : "Copy address"}
            </button>
            {address && (
              <a className="rounded-lg border border-border-low px-3 py-1.5 text-xs hover:bg-mint" target="_blank" rel="noreferrer"
                href={`https://explorer.solana.com/address/${address}?cluster=devnet`}>
                View on Explorer
              </a>
            )}
            <a className="rounded-lg border border-border-low px-3 py-1.5 text-xs hover:bg-mint" target="_blank" rel="noreferrer"
              href="https://faucet.solana.com/">
              Get Devnet SOL
            </a>
          </div>
        </div>
      </div>
      <p className="text-sm text-muted">{NOTES[role]}</p>
      <button onClick={() => { signOut(); disconnect(); }}
        className="rounded-lg border border-border-low bg-card px-4 py-2 text-sm md:hidden">
        Sign out
      </button>
    </div>
  );
}