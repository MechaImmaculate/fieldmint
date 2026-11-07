import { useEffect, useState } from "react";
import { api, type Area } from "../lib/api";
import { useAuth } from "../lib/auth";
import { km, type Submission } from "../lib/field";
import AuthImage from "./AuthImage";
import SubStatus from "./SubStatus";
import TaskMap from "./TaskMap";

export default function SubmissionReview({ s }: { s: Submission }) {
  const { token } = useAuth();
  const [area, setArea] = useState<Area>();
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    if (!token) return;
    api.getCampaign(s.campaign_id, token)
      .then((c) => { setArea(c.area); setInstructions(c.description); })
      .catch(() => {});
  }, [s.campaign_id, token]);

  const rows: [string, string][] = [
    ["Crop", s.crop_type], ["Growth stage", s.growth_stage], ["Condition", s.condition],
    ["Captured", new Date(s.captured_at).toLocaleString()],
    ["GPS", `${s.gps_source === "device" ? "Device" : "Typed in"}${s.accuracy_m != null ? ` · ±${Math.round(s.accuracy_m)} m` : ""}`],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{s.campaign_title}</h2>
          <p className="text-xs text-muted">Submitted {new Date(s.created_at).toLocaleString()}</p>
        </div>
        <SubStatus status={s.status} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-border-low bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-brand">What the organizer asked for</h3>
          {area && <TaskMap area={area} target={[s.target_lat, s.target_lng]} other={[s.lat, s.lng]} />}
          <p className="text-xs text-muted">Green: assigned point with its 150 m range. Blue: where it was submitted.</p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted">Assigned point</dt><dd className="font-mono text-xs">{s.target_lat.toFixed(5)}, {s.target_lng.toFixed(5)}</dd></div>
            <div><dt className="text-xs text-muted">Submitted at</dt><dd className="font-mono text-xs">{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</dd></div>
            <div><dt className="text-xs text-muted">Distance apart</dt><dd className="font-semibold">{km(s.distance_m)}</dd></div>
            <div><dt className="text-xs text-muted">Inside campaign area</dt><dd className="font-semibold">{s.inside_area ? "Yes" : "No"}</dd></div>
          </dl>
          {instructions && <p className="rounded-lg bg-mint p-3 text-sm">{instructions}</p>}
          <p className="text-xs text-muted">Required: photo, GPS location, crop, growth stage and condition.</p>
        </section>

        <section className="space-y-3 rounded-2xl border border-border-low bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-brand">What the contributor submitted</h3>
          <AuthImage id={s.id} className="h-64 w-full rounded-xl object-cover" />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {rows.map(([k, v]) => (
              <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v || "—"}</dd></div>
            ))}
          </dl>
          {s.notes && <blockquote className="rounded-lg border-l-4 border-brand-2 bg-mint/50 p-3 text-sm">{s.notes}</blockquote>}
        </section>
      </div>

      <section className="space-y-2 rounded-2xl border border-border-low bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold">Automated checks</h3>
        <ul className="space-y-1.5">
          {s.checks.map((c) => (
            <li key={c.name} className="flex gap-2 text-sm">
              <span className={c.status === "pass" ? "text-brand-2" : "text-amber-700"}>{c.status === "pass" ? "✓" : "⚑"}</span>
              <span><b>{c.name}</b> <span className="text-muted">{c.detail}</span></span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          These are rule-based checks. A flag is a prompt for a closer look, not a rejection. A reviewer makes the final call.
        </p>
        <p className="break-all font-mono text-xs text-muted">Record fingerprint: {s.record_hash}</p>
        {s.review_reason && <p className="rounded-lg bg-mint p-3 text-sm">Reviewer note: {s.review_reason}</p>}
      </section>
    </div>
  );
}