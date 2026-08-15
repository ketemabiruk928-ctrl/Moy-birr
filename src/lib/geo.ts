import { useCallback, useEffect, useState } from "react";

export type Coords = { lat: number; lng: number };

export function distanceKm(a: Coords, b: Coords) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

type Status = "idle" | "locating" | "ready" | "denied" | "unsupported";

/** GPS location of the current device, with a manual re-locate action. */
export function useMyLocation(auto = true) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("ready");
      },
      () => setStatus("denied"),
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    if (auto) locate();
  }, [auto, locate]);

  return { coords, status, locate };
}

/** Reads hotel/staff ids out of a scanned Moybirr pay link or raw id text. */
export function parsePayCode(raw: string): { hotel?: string; staff?: string } | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    const hotel = url.searchParams.get("hotel") ?? undefined;
    const staff = url.searchParams.get("staff") ?? undefined;
    if (hotel || staff) return { ...(hotel ? { hotel } : {}), ...(staff ? { staff } : {}) };
  } catch {
    /* not a URL */
  }
  const uuid = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) return { hotel: uuid[0] };
  return null;
}
