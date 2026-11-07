import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { CircleMarker, GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { Area } from "../lib/api";

export const STATUS_COLOR: Record<string, string> = {
  open: "#12a37a", claimed: "#38bdf8", submitted: "#f5a524",
  approved: "#0b6b4f", rejected: "#e5484d", paid: "#9945ff",
};
const LABEL: Record<string, string> = {
  open: "Available", claimed: "Claimed", submitted: "Submitted",
  approved: "Approved", rejected: "Rejected", paid: "Paid",
};

type Props = {
  area: Area;
  tasks?: GeoJSON.FeatureCollection;
  userPos?: [number, number] | null;
  onSelect?: (id: string) => void;
};

export default function CampaignMap({ area, tasks, userPos, onSelect }: Props) {
  const bounds = L.geoJSON(area).getBounds();
  return (
    <div className="space-y-2">
      <MapContainer bounds={bounds} className="h-[460px] w-full rounded-2xl border border-border-low">
        <TileLayer
          attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <GeoJSON data={area} style={{ color: "#ffffff", weight: 2, fillOpacity: 0.04 }} />
        {tasks?.features.map((f) => {
          const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
          const p = f.properties as { id: string; status: string; mine?: boolean };
          return (
            <CircleMarker key={p.id} center={[lat, lng]} radius={p.mine ? 9 : 6}
              pathOptions={{
                color: p.mine ? "#111111" : "#ffffff", weight: p.mine ? 3 : 2,
                fillColor: STATUS_COLOR[p.status] ?? STATUS_COLOR.open, fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelect?.(p.id) }} />
          );
        })}
        {userPos && (
          <CircleMarker center={userPos} radius={8}
            pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }} />
        )}
      </MapContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {Object.entries(LABEL).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} />{v}
          </span>
        ))}
        {userPos && (
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />You</span>
        )}
      </div>
    </div>
  );
}