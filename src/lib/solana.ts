import { useEffect, useState } from "react";

export const LAMPORTS_PER_SOL = 1_000_000_000;
export const DEVNET_RPC = "https://api.devnet.solana.com";

export const solFromLamports = (l: number) => l / LAMPORTS_PER_SOL;
export const lamportsFromSol = (s: number) => Math.round(s * LAMPORTS_PER_SOL);
export const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export function useSolBalance(address?: string) {
  const [lamports, setLamports] = useState<number | null>(null);
  useEffect(() => {
    if (!address) return setLamports(null);
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(DEVNET_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address] }),
        });
        const json = await res.json();
        if (!cancelled) setLamports(json.result?.value ?? null);
      } catch {
        if (!cancelled) setLamports(null);
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [address]);
  return lamports;
}