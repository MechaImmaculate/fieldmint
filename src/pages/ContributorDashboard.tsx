import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Campaign, type Me, type Region } from "../lib/api";
import { useAuth } from "../lib/auth";
import { field, type Submission } from "../lib/field";
import { solFromLamports } from "../lib/solana";
import CampaignCard from "../components/CampaignCard";
import SubStatus from "../components/SubStatus";

const box = "w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm";

export default function ContributorDashboard() {
  const { token } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [items, setItems] = useState<Campaign[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [form, setForm] = useState({ display_name: "", county: "Trans Nzoia" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.me(token).then(setMe).catch((e) => setError(String(e)));
    api.regions().then(setRegions).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || !me?.profile) return;
    api.listCampaigns("contribute", token).then(setItems).catch((e) => setError(String(e)));
    field.mine(token).then(setSubs).catch(() => {});
  }, [token, me]);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      await api.saveProfile(form, token);
      setMe(await api.me(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!me) return <p className="text-muted">{error || "Loading…"}</p>;

  if (!me.profile) {
    return (
      <form onSubmit={register} className="mx-auto max-w-md space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Create your contributor profile</h1>
        <p className="text-sm text-muted">We only ask for what we need. No phone number or ID is collected.</p>
        <label className="block space-y-1 text-sm font-medium">Name or nickname
          <input required minLength={2} className={box} value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </label>
        <label className="block space-y-1 text-sm font-medium">Your county
          <select className={box} value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })}>
            {regions.map((r) => <option key={r.name}>{r.name}</option>)}
          </select>
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button disabled={saving} className="w-full rounded-lg bg-brand-2 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "Saving…" : "Create profile"}
        </button>
      </form>
    );
  }

  const count = (st: string) => subs.filter((s) => s.status === st).length;
  const earned = subs.filter((s) => s.status === "paid").reduce((n, s) => n + s.reward_lamports, 0);
  const stats: [string, string | number][] = [
    ["Awaiting review", count("submitted")], ["Approved", count("approved")],
    ["Rejected", count("rejected")], ["Paid so far", `${solFromLamports(earned)} SOL`],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hello, {me.profile.display_name}</h1>
        <p className="mt-1 text-muted">Pick a live campaign, go to a point, and send in what you see.</p>
      </div>

      <div className="grid gap-3 rounded-2xl bg-brand-2 p-5 text-white sm:grid-cols-3">
        {[["Choose a campaign", "Open one below and tap Find points near me."],
          ["Claim and capture", "Go to the point. Take a photo, record the crop, add notes."],
          ["Get approved, get paid", "A reviewer checks it. Approved work is paid on Solana."]].map(([t, d], i) => (
          <div key={t} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-brand">{i + 1}</span>
            <div><p className="font-semibold">{t}</p><p className="text-xs text-white/85">{d}</p></div>
          </div>
        ))}
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

      <section className="space-y-3">
        <h2 className="font-semibold">Live campaigns</h2>
        {items.length === 0 && <p className="text-sm text-muted">No live campaigns right now.</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => <CampaignCard key={c.id} c={c} base="/contribute" />)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Your submissions</h2>
        {subs.length === 0 && <p className="text-sm text-muted">Nothing submitted yet.</p>}
        {subs.map((s) => (
          <Link key={s.id} to={`/contribute/tasks/${s.task_id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-low bg-card p-3 text-sm shadow-sm">
            <span><b>{s.crop_type}</b> · {s.campaign_title}</span>
            <SubStatus status={s.status} />
          </Link>
        ))}
      </section>
    </div>
  );
}