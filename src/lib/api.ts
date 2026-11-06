const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type Area = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export type Region = { name: string; focus: string; priority: number; bbox: number[] };


export type Campaign = {
  id: string;
  title: string;
  description: string;
  campaign_type: string;
  region: string;
  owner_wallet: string;
  reward_lamports: number;
  target_observations: number;
  budget_lamports: number;
  status: string;
  created_at: string;
  area: Area;
  task_count: number;
};

export type NewCampaign = Pick<
  Campaign,
  "title" | "description" | "region" | "owner_wallet" | "reward_lamports" | "target_observations"
> & { campaign_type: string };


async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  regions: () => req<Region[]>("/regions"),
  listCampaigns: (owner?: string) =>
    req<Campaign[]>(`/campaigns${owner ? `?owner=${owner}` : ""}`),
  getCampaign: (id: string) => req<Campaign>(`/campaigns/${id}`),
  getTasks: (id: string) => req<GeoJSON.FeatureCollection>(`/campaigns/${id}/tasks`),
  createCampaign: (body: NewCampaign) =>
    req<Campaign>("/campaigns", { method: "POST", body: JSON.stringify(body) }),
};