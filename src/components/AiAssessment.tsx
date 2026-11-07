import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { field, type AiAssessment as Ai, type Submission } from "../lib/field";

const LABEL: Record<string, [string, string]> = {
  consistent: ["Consistent", "text-brand-2"], good: ["Good", "text-brand-2"],
  inconsistent: ["Inconsistent", "text-danger"], poor: ["Poor", "text-danger"],
  unclear: ["Unclear", "text-amber-700"],
};
const ROWS: [keyof Ai, string][] = [
  ["photo_vs_crop", "Photo matches the declared crop"],
  ["photo_vs_growth_stage", "Photo matches the growth stage"],
  ["form_consistency", "Form and notes agree"],
  ["photo_quality", "Photo is usable evidence"],
];

export default function AiAssessment({ s, canRerun }: { s: Submission; canRerun: boolean }) {
  const { token } = useAuth();
  const [status, setStatus] = useState(s.ai_status);
  const [ai, setAi] = useState<Ai | null>(s.ai);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "pending" || !token) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      try {
        const n = await field.one(s.id, token);
        if (n.ai_status !== "pending") {
          setStatus(n.ai_status);
          setAi(n.ai);
          clearInterval(timer);
        }
      } catch { /* try again */ }
      if (tries >= 30) clearInterval(timer);
    }, 4000);
    return () => clearInterval(timer);
  }, [status, s.id, token]);

  async function rerun() {
    if (!token) return;
    setError("");
    try {
      const n = await field.assess(s.id, token);
      setStatus(n.ai_status);
      setAi(n.ai);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border-low bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">AI assessment <span className="font-normal text-muted">· advisory</span></h3>
        {canRerun && status !== "pending" && (
          <button onClick={rerun} className="text-xs text-brand underline">Re-run</button>
        )}
      </div>

      {status === "pending" && <p className="text-sm text-muted">The AI assessment is running. This usually takes a few seconds.</p>}
      {status === "unavailable" && <p className="text-sm text-muted">AI assessment is not configured on this server. The rule-based checks above still apply.</p>}
      {status === "error" && <p className="text-sm text-danger">{ai?.error ?? "The AI assessment failed."}</p>}

      {status === "done" && ai && (
        <>
          <ul className="space-y-2">
            {ROWS.map(([key, label]) => {
              const item = ai[key] as { verdict: string; explanation: string };
              const [word, color] = LABEL[item.verdict] ?? [item.verdict, "text-muted"];
              return (
                <li key={key} className="text-sm">
                  <span className={`font-semibold ${color}`}>{word}</span> · <b>{label}</b>
                  <p className="text-xs text-muted">{item.explanation}</p>
                </li>
              );
            })}
          </ul>
          {ai.concerns.length > 0 && (
            <div className="rounded-lg bg-amber/10 p-3 text-sm">
              <p className="font-semibold text-amber-700">Concerns</p>
              <ul className="list-disc pl-5">{ai.concerns.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
          {ai.reviewer_focus.length > 0 && (
            <div className="rounded-lg bg-mint p-3 text-sm">
              <p className="font-semibold">Where to look closely</p>
              <ul className="list-disc pl-5">{ai.reviewer_focus.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
          <p className="text-sm">{ai.summary}</p>
          <p className="text-xs text-muted">
            Confidence: {ai.confidence}{ai.photo_seen === false && " · photo could not be analysed"}
            {ai.model && ` · ${ai.model}`}. AI can be wrong. It never approves or rejects anything. The reviewer decides.
          </p>
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}