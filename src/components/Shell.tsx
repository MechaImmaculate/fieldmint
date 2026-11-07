import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import WalletCard from "./WalletCard";

type Role = "org" | "contributor" | "reviewer";

const THEME = {
  org: {
    label: "Organization", page: "bg-background",
    side: "bg-card border-r border-border-low text-foreground", logo: "bg-brand text-white",
    item: "text-muted hover:bg-mint", active: "bg-mint text-brand font-semibold",
    badge: "bg-brand text-white", wallet: "bg-mint text-foreground",
  },
  contributor: {
    label: "Contributor", page: "bg-mint/40",
    side: "bg-brand-2 text-white", logo: "bg-white text-brand",
    item: "text-white/85 hover:bg-white/10", active: "bg-white text-brand font-semibold",
    badge: "bg-white text-brand", wallet: "bg-white/15 text-white",
  },
  reviewer: {
    label: "Reviewer", page: "bg-background",
    side: "bg-ink text-white", logo: "bg-amber text-ink",
    item: "text-white/70 hover:bg-white/10", active: "bg-amber text-ink font-semibold",
    badge: "bg-amber text-ink", wallet: "bg-white/10 text-white",
  },
} as const;

const NAV: Record<Role, [string, string][]> = {
  org: [["Overview", "/org"], ["Campaigns", "/org/campaigns"], ["New campaign", "/org/campaigns/new"], ["Wallet", "/org/wallet"]],
  contributor: [["Live campaigns", "/contribute"], ["Wallet", "/contribute/wallet"]],
  reviewer: [["Review queue", "/review"], ["Campaigns", "/review/campaigns"], ["Wallet", "/review/wallet"]],
};

export default function Shell({ role }: { role: Role }) {
  const t = THEME[role];
  const nav = NAV[role];
  const { roles } = useAuth();

  const Logo = () => (
    <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
      <span className={`grid h-7 w-7 place-items-center rounded-lg text-sm ${t.logo}`}>F</span>
      FieldMint
    </Link>
  );

  return (
    <div className={`min-h-screen md:flex ${t.page}`}>
      <aside className={`hidden w-64 shrink-0 flex-col justify-between p-5 md:sticky md:top-0 md:flex md:h-screen ${t.side}`}>
        <div className="space-y-8">
          <Logo />
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${t.badge}`}>{t.label}</span>
          <nav className="space-y-1">
            {nav.map(([label, to]) => (
              <NavLink key={to} to={to} end
                className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm ${isActive ? t.active : t.item}`}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="space-y-3">
          <WalletCard box={t.wallet} />
          {roles.length > 1 && (
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs opacity-80">
              {roles.includes("org") && role !== "org" && <Link to="/org" className="underline">Organization</Link>}
              {roles.includes("reviewer") && role !== "reviewer" && <Link to="/review" className="underline">Reviewer</Link>}
              {role !== "contributor" && <Link to="/contribute" className="underline">Contributor</Link>}
            </div>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-border-low bg-card px-5 py-3 text-foreground md:hidden">
          <Logo />
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${t.badge}`}>{t.label}</span>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-8 pb-28 md:px-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      <nav className={`fixed inset-x-0 bottom-0 z-[1100] flex justify-around p-2 md:hidden ${t.side}`}>
        {nav.map(([label, to]) => (
          <NavLink key={to} to={to} end
            className={({ isActive }) => `rounded-lg px-3 py-2 text-xs ${isActive ? t.active : t.item}`}>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}