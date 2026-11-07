import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { field, type Submission } from "../lib/field";
import SubmissionReview from "../components/SubmissionReview";

export default function ReviewSubmission() {
  const { id } = useParams();
  const { token } = useAuth();
  const [s, setS] = useState<Submission | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id && token) field.one(id, token).then(setS).catch((e) => setError(String(e)));
  }, [id, token]);

  if (!s) return <p className="text-muted">{error || "Loading…"}</p>;
  return (
    <div className="space-y-4">
      <Link to="/review" className="text-sm text-muted hover:text-foreground">← Back to queue</Link>
      <SubmissionReview s={s} showAi canReview onChange={setS} />
    </div>
  );
}