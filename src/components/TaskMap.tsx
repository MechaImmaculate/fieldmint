import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { Circle, CircleMarker, GeoJSON, MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import type { Area } from "../lib/api";

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 16);
    else map.fitBounds(L.latLngBounds(points).pad(0.5), { maxZoom: 17 });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

type Props = { area: Area; target: [number, number]; other?: [number, number] | null; rangeM?: number };

export default function TaskMap({ area, target, other, rangeM = 150 }: Props) {
  return (
    <MapContainer center={target} zoom={16} className="h-72 w-full rounded-xl border border-border-low">
      <TileLayer
        attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      <GeoJSON data={area} style={{ color: "#ffffff", weight: 2, fillOpacity: 0.03 }} />
      <Circle center={target} radius={rangeM} pathOptions={{ color: "#12a37a", weight: 2, fillOpacity: 0.15 }} />
      {other && <Polyline positions={[target, other]} pathOptions={{ color: "#ffffff", weight: 2, dashArray: "4 6" }} />}
      <CircleMarker center={target} radius={8}
        pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#12a37a", fillOpacity: 1 }} />
      {other && (
        <CircleMarker center={other} radius={8}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }} />
      )}
      <Fit points={other ? [target, other] : [target]} />
    </MapContainer>
  );
}