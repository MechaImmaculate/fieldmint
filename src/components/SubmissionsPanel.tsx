import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { field, type Submission } from "../lib/field";
import SubStatus from "./SubStatus";
import SubmissionReview from "./SubmissionReview";

export default function SubmissionsPanel({ campaignId }: { campaignId: string }) {
  const { token, roles } = useAuth();
  const [items, setItems] = useState<Submission[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (token) field.forCampaign(campaignId, token).then(setItems).catch(() => {});
  }, [campaignId, token]);

  const update = (s: Submission) => setItems((list) => list.map((x) => (x.id === s.id ? s : x)));

  return (
    <section className="space-y-3 rounded-2xl border border-border-low bg-card p-5 shadow-sm">
      <h2 className="font-semibold">Submissions ({items.length})</h2>
      {items.length === 0 && <p className="text-sm text-muted">No submissions yet.</p>}
      {items.map((s) => {
        const flags = s.checks.filter((c) => c.status === "flag").length;
        return (
          <div key={s.id} className="rounded-xl border border-border-low">
            <button onClick={() => setOpen(open === s.id ? null : s.id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left text-sm">
              <span><b>{s.crop_type}</b> · {s.contributor_name ?? s.contributor_wallet.slice(0, 6)}
                {flags > 0 && <span className="ml-2 text-xs text-amber-700">⚑ {flags}</span>}</span>
              <SubStatus status={s.status} />
            </button>
            {open === s.id && (
              <div className="border-t border-border-low p-3">
                <SubmissionReview s={s} showAi canReview={roles.includes("reviewer")} onChange={update} />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}