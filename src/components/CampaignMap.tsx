import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { CircleMarker, GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import { Area } from "../lib/api";

export default function CampaignMap({
  area,
  tasks,
}: {
  area: Area;
  tasks?: GeoJSON.FeatureCollection;
}) {
  const bounds = L.geoJSON(area).getBounds();
  return (
    <MapContainer bounds={bounds} className="h-[420px] w-full rounded-2xl border border-border-low">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON data={area} style={{ color: "#16a34a", weight: 2, fillOpacity: 0.06 }} />
      {tasks?.features.map((f) => {
        const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
        return (
          <CircleMarker
            key={f.properties!.id}
            center={[lat, lng]}
            radius={5}
            pathOptions={{ color: "#16a34a", fillOpacity: 0.8 }}
          />
        );
      })}
    </MapContainer>
  );
}