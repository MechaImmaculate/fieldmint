import { Navigate } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";
import { useAuth } from "../lib/auth";

const roles = [
  ["Organizations", "Commission and fund field-data campaigns."],
  ["Contributors", "Collect observations and get paid."],
  ["Reviewers", "Check quality and release payments."],
];

export default function Login() {
  const { connectors, connect, status } = useWalletConnection();
  const { token, signIn, signingIn, error } = useAuth();
  const connected = status === "connected";

  if (token && connected) return <Navigate to="/app" replace />;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-brand to-brand-2 p-12 text-white lg:flex">
        <a href="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-sm text-brand">F</span>
          FieldMint
        </a>
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">Verified ground truth, paid on Solana.</h1>
          <ul className="space-y-3">
            {roles.map(([t, d]) => (
              <li key={t} className="rounded-xl bg-white/10 p-4">
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-white/80">{d}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/70">Prototype · Solana Devnet</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Sign in to FieldMint</h2>
            <p className="mt-1 text-sm text-muted">
              No password. You prove you own your wallet by signing a free message.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border-low bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold">1. Connect your wallet</p>
            {connected ? (
              <p className="rounded-lg bg-mint px-3 py-2 text-sm text-brand">Wallet connected</p>
            ) : connectors.length === 0 ? (
              <p className="text-sm text-muted">No wallet found. Install Phantom or Solflare, then refresh.</p>
            ) : (
              <div className="grid gap-2">
                {connectors.map((c) => (
                  <button key={c.id} onClick={() => connect(c.id)} disabled={status === "connecting"}
                    className="rounded-lg border border-border-low px-4 py-2.5 text-left text-sm font-medium hover:bg-mint disabled:opacity-60">
                    {status === "connecting" ? "Connecting…" : c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`space-y-3 rounded-2xl border border-border-low bg-card p-5 shadow-sm ${connected ? "" : "opacity-50"}`}>
            <p className="text-sm font-semibold">2. Verify it's you</p>
            <button onClick={signIn} disabled={!connected || signingIn}
              className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {signingIn ? "Check your wallet…" : "Sign in"}
            </button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>

          <p className="text-xs text-muted">
            Organizations and reviewers are approved by FieldMint. Everyone else joins as a contributor.
          </p>
        </div>
      </div>
    </div>
  );
}