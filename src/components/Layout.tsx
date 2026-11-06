import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";
import { shortAddr, solFromLamports, useSolBalance } from "../lib/solana";
import { useAuth } from "../lib/auth";

function WalletArea() {
  const { connectors, connect, disconnect, wallet, status } = useWalletConnection();
  const { token, roles, signIn, signOut, signingIn, error } = useAuth();
  const [open, setOpen] = useState(false);
  const address = wallet?.account.address.toString();
  const balance = useSolBalance(address);

  if (status === "connected" && address) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
        <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-brand">
          Devnet · {balance === null ? "…" : solFromLamports(balance).toFixed(3)} SOL
        </span>
        <span className="font-mono text-xs text-muted">{shortAddr(address)}</span>
        {token ? (
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
            {roles.includes("org") ? "Organization" : "Signed in"}
          </span>
        ) : (
          <button onClick={signIn} disabled={signingIn}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {signingIn ? "Check wallet…" : "Sign in"}
          </button>
        )}
        <button onClick={() => { signOut(); disconnect(); }}
          className="rounded-lg border border-border-low bg-card px-3 py-1.5 text-xs hover:shadow-sm">
          Disconnect
        </button>
        {error && <p className="w-full text-right text-xs text-danger">{error}</p>}
      </div>
    );
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
        {status === "connecting" ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <div className="absolute right-0 z-[1000] mt-2 w-56 rounded-xl border border-border-low bg-card p-2 shadow-lg">
          {connectors.length === 0 && (
            <p className="p-2 text-xs text-muted">No wallet found. Install Phantom or Solflare.</p>
          )}
          {connectors.map((c) => (
            <button key={c.id} onClick={() => { connect(c.id); setOpen(false); }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-mint">
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const link = ({ isActive }: { isActive: boolean }) =>
    `text-sm ${isActive ? "font-semibold text-brand" : "text-muted hover:text-foreground"}`;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-[900] border-b border-border-low bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-brand">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm text-white">F</span>
              FieldMint
            </Link>
            <nav className="flex gap-5">
              <NavLink to="/campaigns" end className={link}>Campaigns</NavLink>
              <NavLink to="/campaigns/new" className={link}>New campaign</NavLink>
            </nav>
          </div>
          <WalletArea />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
      <footer className="border-t border-border-low py-6 text-center text-xs text-muted">
        FieldMint prototype · Solana Devnet · County boundaries: geoBoundaries
      </footer>
    </div>
  );
}