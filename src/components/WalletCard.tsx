import { useWalletConnection } from "@solana/react-hooks";
import { useAuth } from "../lib/auth";
import { shortAddr, solFromLamports, useSolBalance } from "../lib/solana";

export default function WalletCard({ box }: { box: string }) {
  const { wallet, disconnect } = useWalletConnection();
  const { signOut } = useAuth();
  const address = wallet?.account.address.toString();
  const balance = useSolBalance(address);
  return (
    <div className={`space-y-2 rounded-xl p-3 text-sm ${box}`}>
      <div className="flex items-center justify-between text-xs opacity-80">
        <span>Devnet wallet</span>
        <span className="font-mono">{address ? shortAddr(address) : "—"}</span>
      </div>
      <p className="text-2xl font-bold">
        {balance === null ? "…" : solFromLamports(balance).toFixed(3)}{" "}
        <span className="text-xs font-medium opacity-80">SOL</span>
      </p>
      <button onClick={() => { signOut(); disconnect(); }}
        className="w-full rounded-lg border border-current/30 px-3 py-1.5 text-xs opacity-90 hover:opacity-100">
        Sign out
      </button>
    </div>
  );
}