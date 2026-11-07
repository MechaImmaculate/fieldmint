import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Campaign } from "../lib/api";
import { useAuth } from "../lib/auth";
import { field, haversine, km } from "../lib/field";
import { solFromLamports } from "../lib/solana";
import CampaignMap from "../components/CampaignMap";

export default function ContributorCampaign() {
  const { id } = useParams();
  const { token } = useAuth();
  const nav = useNavigate();
  const [c, setC] = useState<Campaign | null>(null);
  const [map, setMap] = useState<GeoJSON.FeatureCollection>();
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    if (!id || !token) return;
    api.getCampaign(id, token).then(setC).catch((e) => setError(String(e)));
    field.map(id, token).then(setMap).catch(() => {});
  }, [id, token]);
  useEffect(() => { load(); }, [load]);

  function locate() {
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos([p.coords.latitude, p.coords.longitude]); setLocating(false); },
      (e) => { setError(`Could not get your location: ${e.message}`); setLocating(false); },
      { enableHighAccuracy: true, timeout: 20000 },
    );
  }

  async function claim(taskId: string) {
    if (!token) return;
    setBusy(taskId);
    setError("");
    try {
      await field.claim(taskId, token);
      nav(`/contribute/tasks/${taskId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy("");
    }
  }

  if (!c) return <p className="text-muted">{error || "Loading…"}</p>;

  const feats = (map?.features ?? []).map((f) => {
    const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
    const p = f.properties as { id: string; status: string; mine: boolean };
    return { id: p.id, status: p.status, mine: p.mine, dist: pos ? haversine(pos[0], pos[1], lat, lng) : null };
  });
  const mine = feats.filter((f) => f.mine && f.status !== "open");
  const open = feats.filter((f) => f.status === "open")
    .sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0)).slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{c.region}</p>
        <h1 className="text-2xl font-bold">{c.title}</h1>
        <p className="mt-1 text-sm text-muted">{c.description}</p>
        <p className="mt-2 text-sm"><b>{solFromLamports(c.reward_lamports)} SOL</b> per approved observation</p>
      </div>

      <div className="grid gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm sm:grid-cols-3">
        {[["Find a point", "Use your location to see the nearest open points."],
          ["Go and capture", "Stand at the point, take a clear photo, and note what you see."],
          ["Get paid", "Once a reviewer approves, the reward is released on Solana."]].map(([t, d], i) => (
          <div key={t} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-2 text-xs font-bold text-white">{i + 1}</span>
            <div><p className="font-semibold">{t}</p><p className="text-xs text-muted">{d}</p></div>
          </div>
        ))}
      </div>

      <button onClick={locate} disabled={locating}
        className="rounded-lg bg-brand-2 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {locating ? "Finding you…" : pos ? "Update my location" : "Find points near me"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}

      <CampaignMap area={c.area} tasks={map} userPos={pos} />

      {mine.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Your points</h2>
          {mine.map((f) => (
            <Link key={f.id} to={`/contribute/tasks/${f.id}`}
              className="flex items-center justify-between rounded-xl border border-border-low bg-card p-3 text-sm shadow-sm">
              <span>Point {f.id.slice(0, 6)}{f.dist != null && <span className="text-muted"> · {km(f.dist)} away</span>}</span>
              <span className="font-semibold text-brand">{f.status === "claimed" ? "Open and submit" : "View"}</span>
            </Link>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">{pos ? "Nearest open points" : "Open points"}</h2>
        {open.length === 0 && <p className="text-sm text-muted">No open points left in this campaign.</p>}
        {open.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-xl border border-border-low bg-card p-3 text-sm shadow-sm">
            <span>Point {f.id.slice(0, 6)}{f.dist != null && <span className="text-muted"> · {km(f.dist)} away</span>}</span>
            <button onClick={() => claim(f.id)} disabled={!!busy}
              className="rounded-lg bg-brand-2 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
              {busy === f.id ? "Claiming…" : "Claim"}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}