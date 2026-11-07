import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { field, haversine, km, type Submission, type TaskDetail } from "../lib/field";
import SubmissionReview from "../components/SubmissionReview";
import TaskMap from "../components/TaskMap";

type Pos = { lat: number; lng: number; acc: number | null; source: "device" | "manual" };

const CROPS = ["Maize", "Wheat", "Beans", "Potatoes", "Other"];
const STAGES = ["Not yet planted", "Emergence", "Vegetative", "Flowering", "Grain filling", "Mature", "Harvested"];
const CONDITIONS = ["Healthy", "Mild stress", "Severe stress", "Damaged", "Fallow / bare"];
const box = "w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm";

async function shrink(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("Could not process that photo"))), "image/jpeg", 0.85));
}

function Pick({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block space-y-1 text-sm font-medium">{label}
      <select className={box} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

export default function TaskSubmit() {
  const { id } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState<TaskDetail | null>(null);
  const [done, setDone] = useState<Submission | null>(null);
  const [device, setDevice] = useState<Pos | null>(null);
  const [manual, setManual] = useState(false);
  const [mLat, setMLat] = useState("");
  const [mLng, setMLng] = useState("");
  const [locating, setLocating] = useState(false);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string; takenAt: number } | null>(null);
  const [crop, setCrop] = useState("");
  const [stage, setStage] = useState("");
  const [cond, setCond] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id && token) field.task(id, token).then(setData).catch((e) => setError(String(e)));
  }, [id, token]);

  if (!data) return <p className="text-muted">{error || "Loading…"}</p>;

  const sub = done ?? data.submission;
  if (sub) {
    return (
      <div className="space-y-4">
        <Link to="/contribute" className="text-sm text-muted hover:text-foreground">← Back to dashboard</Link>
        {done && (
          <p className="rounded-xl bg-brand-2/15 p-4 text-sm text-brand">
            Submitted. The automated checks ran instantly. A reviewer decides next, and an approved observation is paid on Solana.
          </p>
        )}
        <SubmissionReview s={sub} />
      </div>
    );
  }
  if (!data.task.mine || data.task.status !== "claimed") {
    return <p className="text-muted">This point is not claimed by you. <Link className="text-brand underline" to="/contribute">Back</Link></p>;
  }

  const pos: Pos | null = manual
    ? (mLat && mLng && Number.isFinite(+mLat) && Number.isFinite(+mLng) ? { lat: +mLat, lng: +mLng, acc: null, source: "manual" } : null)
    : device;
  const target: [number, number] = [data.task.lat, data.task.lng];
  const dist = pos ? haversine(target[0], target[1], pos.lat, pos.lng) : null;
  const missing = [
    !pos && "Capture your location", !photo && "Add a photo of the crop",
    !crop && "Choose the crop", !stage && "Choose the growth stage", !cond && "Choose the condition",
  ].filter(Boolean) as string[];

  function locate() {
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setDevice({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, source: "device" });
        setLocating(false);
      },
      (e) => { setError(`Could not get your location: ${e.message}. You can type coordinates instead.`); setLocating(false); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const blob = await shrink(file);
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto({ blob, url: URL.createObjectURL(blob), takenAt: Math.min(file.lastModified || Date.now(), Date.now()) });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that photo");
    }
  }

  async function submit() {
    if (!token || !id || !pos || !photo) return;
    setBusy(true);
    setError("");
    const f = new FormData();
    f.append("lat", String(pos.lat));
    f.append("lng", String(pos.lng));
    if (pos.acc != null) f.append("accuracy_m", String(pos.acc));
    f.append("gps_source", pos.source);
    f.append("captured_at", new Date(photo.takenAt).toISOString());
    f.append("crop_type", crop);
    f.append("growth_stage", stage);
    f.append("condition", cond);
    f.append("notes", notes);
    f.append("photo", photo.blob, "photo.jpg");
    try {
      setDone(await field.submit(id, f, token));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const range = dist == null ? null : dist <= 150
    ? ["In range of the assigned point", "bg-brand-2/15 text-brand"]
    : ["Far from the assigned point. Move closer, or explain why in your notes.", "bg-amber/15 text-amber-700"];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/contribute" className="text-sm text-muted hover:text-foreground">← Back to dashboard</Link>
      <div>
        <h1 className="text-2xl font-bold">{data.campaign.title}</h1>
        <p className="mt-1 text-sm text-muted">{data.campaign.description}</p>
      </div>

      <section className="space-y-3 rounded-2xl border border-border-low bg-card p-4 shadow-sm">
        <h2 className="font-semibold">1. Your location</h2>
        <TaskMap area={data.campaign.area} target={target} other={pos ? [pos.lat, pos.lng] : null} />
        <p className="text-xs text-muted">Green circle: your assigned point and its 150 m range. Blue dot: you.</p>
        {!manual ? (
          <button onClick={locate} disabled={locating}
            className="w-full rounded-lg bg-brand-2 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {locating ? "Finding you…" : device ? "Update my location" : "Use my location"}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <input className={box} placeholder="Latitude (e.g. 1.0123)" inputMode="decimal" value={mLat} onChange={(e) => setMLat(e.target.value)} />
            <input className={box} placeholder="Longitude (e.g. 34.9876)" inputMode="decimal" value={mLng} onChange={(e) => setMLng(e.target.value)} />
          </div>
        )}
        <button className="text-xs text-muted underline" onClick={() => setManual((m) => !m)}>
          {manual ? "Use my device GPS instead" : "Type coordinates instead (will be flagged for review)"}
        </button>
        {pos && (
          <div className="space-y-2 text-sm">
            <p className="font-mono text-xs">
              {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
              {pos.acc != null && ` · accuracy ±${Math.round(pos.acc)} m`} · {pos.source === "device" ? "device GPS" : "typed in"}
            </p>
            {range && <p className={`rounded-lg px-3 py-2 text-xs font-medium ${range[1]}`}>{km(dist!)} away. {range[0]}</p>}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border-low bg-card p-4 shadow-sm">
        <h2 className="font-semibold">2. Photo evidence</h2>
        <input type="file" accept="image/*" capture="environment" onChange={onPhoto}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-2 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
        {photo && <img src={photo.url} alt="Your photo" className="h-56 w-full rounded-xl object-cover" />}
        <p className="text-xs text-muted">Take a clear photo of the crop at this spot. It is resized on your phone before upload.</p>
      </section>

      <section className="space-y-3 rounded-2xl border border-border-low bg-card p-4 shadow-sm">
        <h2 className="font-semibold">3. What you observed</h2>
        <Pick label="Crop" value={crop} onChange={setCrop} options={CROPS} />
        <Pick label="Growth stage" value={stage} onChange={setStage} options={STAGES} />
        <Pick label="Condition" value={cond} onChange={setCond} options={CONDITIONS} />
        <label className="block space-y-1 text-sm font-medium">Notes (optional)
          <textarea rows={3} className={box} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything a reviewer should know: pests, flooding, access problems…" />
        </label>
      </section>

      {missing.length > 0 && (
        <ul className="rounded-xl bg-amber/10 p-3 text-sm text-amber-700">
          {missing.map((m) => <li key={m}>• {m}</li>)}
        </ul>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button onClick={submit} disabled={busy || missing.length > 0}
        className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "Submitting…" : "Submit for review"}
      </button>
    </div>
  );
}