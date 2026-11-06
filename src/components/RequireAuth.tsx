import { Outlet } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";
import { useAuth } from "../lib/auth";
import Gate from "./Gate";

export default function RequireAuth({ role }: { role?: string }) {
  const { status } = useWalletConnection();
  const { token, roles, signIn, signingIn, error } = useAuth();

  if (status === "connecting") return <Gate title="Connecting…" text="Waiting for your wallet." />;
  if (status !== "connected") {
    return <Gate title="Sign in to FieldMint" text="Connect your wallet with the button in the header to continue." />;
  }
  if (!token) {
    return (
      <Gate title="Verify it's you" text="Sign a free message with your wallet. It costs nothing and proves you own this address.">
        <button onClick={signIn} disabled={signingIn}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {signingIn ? "Check your wallet…" : "Sign in with wallet"}
        </button>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </Gate>
    );
  }
  if (role && !roles.includes(role)) {
    return <Gate title="Not available for this account" text="This wallet doesn't have access to that dashboard." />;
  }
  return <Outlet />;
}