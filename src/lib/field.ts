const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type Check = { name: string; status: "pass" | "flag"; detail: string; source: string };

export type Submission = {
  id: string; task_id: string; campaign_id: string; campaign_title: string; reward_lamports: number;
  contributor_wallet: string; contributor_name: string | null;
  status: "submitted" | "approved" | "rejected" | "paid";
  crop_type: string; growth_stage: string; condition: string; notes: string;
  lng: number; lat: number; target_lng: number; target_lat: number;
  distance_m: number; inside_area: boolean; accuracy_m: number | null; gps_source: string;
  captured_at: string; created_at: string; checks: Check[]; record_hash: string; photo_sha256: string;
  review_reason: string | null; reviewed_by: string | null; reviewed_at: string | null;
  payment_signature: string | null;
};

export type TaskDetail = {
  task: { id: string; status: string; lng: number; lat: number; mine: boolean };
  campaign: {
    id: string; title: string; description: string; reward_lamports: number; status: string;
    area: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  };
  submission: Submission | null;
};

async function call<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const plainBody = init.body && !(init.body instanceof FormData);
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(plainBody ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}` },
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

export const field = {
  map: (id: string, token: string) => call<GeoJSON.FeatureCollection>(`/campaigns/${id}/map`, token),
  task: (id: string, token: string) => call<TaskDetail>(`/tasks/${id}`, token),
  claim: (id: string, token: string) => call<{ ok: boolean }>(`/tasks/${id}/claim`, token, { method: "POST" }),
  release: (id: string, token: string) => call<{ ok: boolean }>(`/tasks/${id}/release`, token, { method: "POST" }),
  submit: (id: string, form: FormData, token: string) =>
    call<Submission>(`/tasks/${id}/submit`, token, { method: "POST", body: form }),
  mine: (token: string) => call<Submission[]>("/me/submissions", token),
  forCampaign: (id: string, token: string) => call<Submission[]>(`/campaigns/${id}/submissions`, token),
  one: (id: string, token: string) => call<Submission>(`/submissions/${id}`, token),
    queue: (token: string) => call<Submission[]>("/review/submissions", token),
  review: (id: string, body: { decision: "approved" | "rejected"; reason: string }, token: string) =>
    call<Submission>(`/submissions/${id}/review`, token, { method: "POST", body: JSON.stringify(body) }),
  confirmPayment: (id: string, signature: string | null, token: string) =>
    call<Submission>(`/submissions/${id}/confirm-payment`, token, { method: "POST", body: JSON.stringify({ signature }) }),
  photoUrl: async (id: string, token: string) => {
    const res = await fetch(`${API}/submissions/${id}/photo`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("Photo unavailable");
    return URL.createObjectURL(await res.blob());
  },
};

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);