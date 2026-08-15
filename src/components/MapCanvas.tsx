import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { Coords } from "@/lib/geo";

export type MapPin = {
  id: string;
  kind: "hotel" | "staff";
  lat: number;
  lng: number;
  label: string;
};

function pinIcon(kind: MapPin["kind"], active: boolean) {
  const bg = kind === "hotel" ? "hsl(var(--primary))" : "hsl(var(--foreground))";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${active ? 34 : 26}px;height:${active ? 34 : 26}px;border-radius:9999px;
      background:${bg};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;color:#fff;
      font:700 ${active ? 15 : 12}px/1 system-ui;">${kind === "hotel" ? "H" : "S"}</div>`,
    iconSize: [active ? 34 : 26, active ? 34 : 26],
    iconAnchor: [active ? 17 : 13, active ? 17 : 13],
  });
}

function Recenter({ center, zoom }: { center: Coords; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [map, center.lat, center.lng, zoom]);
  return null;
}

export default function MapCanvas({
  pins,
  center,
  zoom = 12,
  selectedId,
  onSelect,
}: {
  pins: MapPin[];
  center: Coords;
  zoom?: number;
  selectedId?: string | null;
  onSelect: (pin: MapPin) => void;
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full"
      style={{ background: "hsl(var(--muted))" }}
    >
      <Recenter center={center} zoom={zoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pins.map((p) => (
        <Marker
          key={`${p.kind}-${p.id}`}
          position={[p.lat, p.lng]}
          icon={pinIcon(p.kind, selectedId === `${p.kind}-${p.id}`)}
          title={p.label}
          eventHandlers={{ click: () => onSelect(p) }}
        />
      ))}
    </MapContainer>
  );
}
