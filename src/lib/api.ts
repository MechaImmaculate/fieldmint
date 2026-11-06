const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type Area = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export type Region = { name: string; focus: string; priority: number; bbox: number[] };
export type AppConfig = { escrow: string; cluster: string };
export type AuthResult = { token: string; wallet: string; roles: string[] };

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
  funding_signature: string | null;
  funded_at: string | null;
  created_at: string;
  area: Area;
  task_count: number;
};

export type NewCampaign = {
  title: string;
  description: string;
  campaign_type: string;
  region: string;
  reward_lamports: number;
  target_observations: number;
};

export type Me = {
  wallet: string;
  roles: string[];
  profile: { display_name: string; county: string } | null;
};

async function req<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    let msg = await res.text();
    try {
      const d = JSON.parse(msg).detail;
      msg = typeof d === "string" ? d : JSON.stringify(d);
    } catch { /* keep raw text */ }
    throw new Error(msg);
  }
  return res.json();
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const api = {
  config: () => req<AppConfig>("/config"),
  regions: () => req<Region[]>("/regions"),
  listCampaigns: (view: "org" | "review" | "contribute", token: string) =>
    req<Campaign[]>(`/campaigns?view=${view}`, {}, token),
  getCampaign: (id: string, token: string) => req<Campaign>(`/campaigns/${id}`, {}, token),
  getTasks: (id: string, token: string) =>
    req<GeoJSON.FeatureCollection>(`/campaigns/${id}/tasks`, {}, token),
  me: (token: string) => req<Me>("/me", {}, token),
  saveProfile: (body: { display_name: string; county: string }, token: string) =>
    req<{ ok: boolean }>("/me/profile", { method: "PUT", body: JSON.stringify(body) }, token),
  createCampaign: (body: NewCampaign, token: string) =>
    req<Campaign>("/campaigns", post(body), token),
  fundCampaign: (id: string, signature: string, token: string) =>
    req<Campaign>(`/campaigns/${id}/fund`, post({ signature }), token),
  challenge: (wallet: string) => req<{ message: string }>("/auth/challenge", post({ wallet })),
  verify: (wallet: string, message: string, signature: string) =>
    req<AuthResult>("/auth/verify", post({ wallet, message, signature })),
  getMe: (token: string) => req<Me>("/me", { headers: { Authorization: `Bearer ${token}` } }),
};