import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Campaign } from "../lib/api";
import { useAuth } from "../lib/auth";
import CampaignCard from "../components/CampaignCard";

type Props = {
  view: "org" | "review" | "contribute";
  base: string;
  title: string;
  subtitle: string;
  actionTo?: string;
  actionLabel?: string;
};

export default function CampaignsPage({ view, base, title, subtitle, actionTo, actionLabel }: Props) {
  const { token } = useAuth();
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.listCampaigns(view, token).then(setItems).catch((e) => setError(String(e)));
  }, [view, token]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-muted">{subtitle}</p>
        </div>
        {actionTo && (
          <Link to={actionTo} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            {actionLabel}
          </Link>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {items?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border-strong p-10 text-center text-muted">
          Nothing here yet.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((c) => <CampaignCard key={c.id} c={c} base={base} />)}
      </div>
    </div>
  );
}