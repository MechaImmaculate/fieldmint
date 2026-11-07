import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";
import { useAuth } from "../lib/auth";

export default function RequireAuth({ role }: { role: string }) {
  const { status } = useWalletConnection();
  const { token, roles } = useAuth();
  const loc = useLocation();

  if (status === "connecting") {
    return <div className="grid min-h-screen place-items-center text-muted">Connecting your wallet…</div>;
  }
  if (status !== "connected" || !token) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  if (!roles.includes(role)) return <Navigate to="/app" replace />;
  return <Outlet />;
}