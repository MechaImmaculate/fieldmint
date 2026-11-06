import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useWalletSession } from "@solana/react-hooks";
import { api } from "./api";

type Stored = { wallet: string; token: string; roles: string[] };
type AuthState = {
  token: string | null;
  roles: string[];
  signingIn: boolean;
  error: string;
  signIn: () => Promise<void>;
  signOut: () => void;
};

const Ctx = createContext<AuthState>({
  token: null, roles: [], signingIn: false, error: "",
  signIn: async () => {}, signOut: () => {},
});
export const useAuth = () => useContext(Ctx);

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const KEY = "fm-auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useWalletSession();
  const wallet = session?.account.address.toString();
  const [auth, setAuth] = useState<Stored | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(KEY) ?? "null"); } catch { return null; }
  });
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  // Drop the session if the user switches to a different wallet.
  useEffect(() => {
    if (wallet && auth && auth.wallet !== wallet) {
      setAuth(null);
      sessionStorage.removeItem(KEY);
    }
  }, [wallet, auth]);

  const signOut = useCallback(() => {
    setAuth(null);
    sessionStorage.removeItem(KEY);
  }, []);

  const signIn = useCallback(async () => {
    if (!session || !wallet) return;
    if (!session.signMessage) {
      setError("This wallet cannot sign messages. Try Phantom or Solflare.");
      return;
    }
    setSigningIn(true);
    setError("");
    try {
      const { message } = await api.challenge(wallet);
      const signature = await session.signMessage(new TextEncoder().encode(message));
      const res = await api.verify(wallet, message, b64(signature));
      const next = { wallet, token: res.token, roles: res.roles };
      setAuth(next);
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSigningIn(false);
    }
  }, [session, wallet]);

  const valid = auth && (!wallet || auth.wallet === wallet);
  return (
    <Ctx.Provider value={{
      token: valid ? auth.token : null,
      roles: valid ? auth.roles : [],
      signingIn, error, signIn, signOut,
    }}>
      {children}
    </Ctx.Provider>
  );
}