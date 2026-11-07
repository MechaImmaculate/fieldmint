import { useEffect, useState } from "react";
import { api, type Campaign, type Me, type Region } from "../lib/api";
import { useAuth } from "../lib/auth";
import CampaignCard from "../components/CampaignCard";

const field = "w-full rounded-lg border border-border-low bg-card px-3 py-2 text-sm";

export default function ContributorDashboard() {
  const { token } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [items, setItems] = useState<Campaign[]>([]);
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
        <p className="text-sm text-muted">We only ask for what we need. No phone number or ID is collected at this stage.</p>
        <label className="block space-y-1 text-sm font-medium">Name or nickname
          <input required minLength={2} className={field} value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </label>
        <label className="block space-y-1 text-sm font-medium">Your county
          <select className={field} value={form.county}
            onChange={(e) => setForm({ ...form, county: e.target.value })}>
            {regions.map((r) => <option key={r.name}>{r.name}</option>)}
          </select>
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button disabled={saving}
          className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "Saving…" : "Create profile"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hello, {me.profile.display_name}</h1>
        <p className="mt-1 text-muted">Live campaigns open for observations. Submitting observations is the next thing we build.</p>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border-strong p-10 text-center text-muted">
          No live campaigns right now.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => <CampaignCard key={c.id} c={c} base="/contribute" />)}
      </div>
    </div>
  );
}