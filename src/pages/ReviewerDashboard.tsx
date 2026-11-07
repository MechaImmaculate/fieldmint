import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { field, km, type Submission } from "../lib/field";
import SubStatus from "../components/SubStatus";

const TABS: [string, string][] = [
  ["submitted", "Awaiting review"], ["approved", "Approved, unpaid"],
  ["paid", "Paid"], ["rejected", "Rejected"], ["all", "All"],
];

export default function ReviewerDashboard() {
  const { token } = useAuth();
  const [items, setItems] = useState<Submission[]>([]);
  const [tab, setTab] = useState("submitted");
  const [error, setError] = useState("");

  useEffect(() => {
    if (token) field.queue(token).then(setItems).catch((e) => setError(String(e)));
  }, [token]);

  const flagged = (s: Submission) => s.checks.filter((c) => c.status === "flag").length;
  const count = (st: string) => items.filter((s) => s.status === st).length;
  const shown = tab === "all" ? items : items.filter((s) => s.status === tab);
  const stats: [string, number][] = [
    ["Awaiting review", count("submitted")],
    ["With flags", items.filter((s) => s.status === "submitted" && flagged(s) > 0).length],
    ["Approved, unpaid", count("approved")],
    ["Paid", count("paid")],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review queue</h1>
        <p className="mt-1 text-muted">Check each observation against the task. Approve it, then release the payment.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border-low bg-card p-4 shadow-sm">
            <p className="text-xs text-muted">{k}</p>
            <p className="mt-1 text-xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? "bg-ink text-white" : "border border-border-low bg-card text-muted"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {shown.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border-strong p-10 text-center text-muted">Nothing in this list.</p>
        )}
        {shown.map((s) => (
          <Link key={s.id} to={`/review/submissions/${s.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-low bg-card p-4 text-sm shadow-sm transition hover:shadow-md">
            <div>
              <p className="font-semibold">{s.crop_type} · {s.campaign_title}</p>
              <p className="text-xs text-muted">
                {s.contributor_name ?? s.contributor_wallet.slice(0, 6)} · {km(s.distance_m)} from point · {new Date(s.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {flagged(s) > 0 && <span className="text-xs font-medium text-amber-700">⚑ {flagged(s)} flag{flagged(s) > 1 ? "s" : ""}</span>}
              <SubStatus status={s.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}