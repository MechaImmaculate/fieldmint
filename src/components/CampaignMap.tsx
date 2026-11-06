import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { CircleMarker, GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { Area } from "../lib/api";

const STATUS_FILL: Record<string, string> = {
  open: "#12a37a",
  submitted: "#f5a524",
  approved: "#0b6b4f",
  rejected: "#e5484d",
};

export default function CampaignMap({ area, tasks }: { area: Area; tasks?: GeoJSON.FeatureCollection }) {
  const bounds = L.geoJSON(area).getBounds();
  return (
    <MapContainer bounds={bounds} className="h-[460px] w-full rounded-2xl border border-border-low">
      <TileLayer
        attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      <GeoJSON data={area} style={{ color: "#ffffff", weight: 2, fillOpacity: 0.04 }} />
      {tasks?.features.map((f) => {
        const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
        const fill = STATUS_FILL[String(f.properties?.status)] ?? STATUS_FILL.open;
        return (
          <CircleMarker key={f.properties!.id} center={[lat, lng]} radius={6}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: fill, fillOpacity: 1 }} />
        );
      })}
    </MapContainer>
  );
}