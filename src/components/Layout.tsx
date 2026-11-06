import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";
import { shortAddr, solFromLamports, useSolBalance } from "../lib/solana";

function WalletButton() {
  const { connectors, connect, disconnect, wallet, status } = useWalletConnection();
  const [open, setOpen] = useState(false);
  const address = wallet?.account.address.toString();
  const balance = useSolBalance(address);

  if (status === "connected" && address) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold">
          Devnet · {balance === null ? "…" : solFromLamports(balance).toFixed(3)} SOL
        </span>
        <span className="font-mono text-xs">{shortAddr(address)}</span>
        <button onClick={() => disconnect()} className="rounded-lg border border-border-low px-3 py-1.5 hover:shadow-sm">
          Disconnect
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-bg1"
      >
        {status === "connecting" ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <div className="absolute right-0 z-[1000] mt-2 w-56 rounded-xl border border-border-low bg-card p-2 shadow-lg">
          {connectors.length === 0 && <p className="p-2 text-xs text-muted">No wallet found. Install Phantom or Solflare.</p>}
          {connectors.map((c) => (
            <button
              key={c.id}
              onClick={() => { connect(c.id); setOpen(false); }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-cream"
            >
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
    `text-sm ${isActive ? "font-semibold" : "text-muted hover:text-foreground"}`;
  return (
    <div className="min-h-screen bg-bg1 text-foreground">
      <header className="border-b border-border-low">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-lg font-semibold tracking-tight">FieldMint</Link>
            <nav className="flex gap-5">
              <NavLink to="/" end className={link}>Campaigns</NavLink>
              <NavLink to="/campaigns/new" className={link}>New campaign</NavLink>
            </nav>
          </div>
          <WalletButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}