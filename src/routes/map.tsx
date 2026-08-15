import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { MapPin as MapPinIcon, Navigation, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatETB, useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { distanceKm, formatDistance, useMyLocation, type Coords } from "@/lib/geo";
import type { MapPin } from "@/components/MapCanvas";
import { MediaImg } from "@/components/Media";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MapCanvas = lazy(() => import("@/components/MapCanvas"));

const ADDIS: Coords = { lat: 9.0192, lng: 38.7525 };

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Hotel & Staff Map — Moybirr" },
      {
        name: "description",
        content:
          "See Ethiopian hotels and hospitality staff as pins on a live map. Tap any pin to view details, book a room or tip a staff member from your Moybirr wallet.",
      },
      { property: "og:title", content: "Map View — Moybirr" },
      {
        property: "og:description",
        content: "Hotels and rated staff around you, plotted on a map with GPS distances.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <MapPage />
      </AppShell>
    </RequireAuth>
  ),
});

type Layer = "all" | "hotel" | "staff";

function MapPage() {
  const { t } = useLang();
  const { coords: me, status, locate } = useMyLocation();
  const [layer, setLayer] = useState<Layer>("all");
  const [selected, setSelected] = useState<MapPin | null>(null);

  const hotels = useQuery({
    queryKey: ["map-hotels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotels")
        .select("id,name,city,description,photo_url,price_from,lat,lng");
      if (error) throw error;
      return data ?? [];
    },
  });

  const staff = useQuery({
    queryKey: ["map-staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("id,position,city,rating,rating_count,lat,lng,hotel_id, profiles:user_id(full_name)");
      if (error) throw error;
      return data ?? [];
    },
  });

  const pins = useMemo<MapPin[]>(() => {
    const hotelPins: MapPin[] = (hotels.data ?? [])
      .filter((h) => h.lat != null && h.lng != null)
      .map((h) => ({ id: h.id, kind: "hotel", lat: h.lat!, lng: h.lng!, label: h.name }));
    const staffPins: MapPin[] = (staff.data ?? [])
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        id: s.id,
        kind: "staff",
        lat: s.lat!,
        lng: s.lng!,
        label: (s.profiles as { full_name?: string } | null)?.full_name || "Staff member",
      }));
    if (layer === "hotel") return hotelPins;
    if (layer === "staff") return staffPins;
    return [...hotelPins, ...staffPins];
  }, [hotels.data, staff.data, layer]);

  const hotel =
    selected?.kind === "hotel" ? (hotels.data ?? []).find((h) => h.id === selected.id) : undefined;
  const person =
    selected?.kind === "staff" ? (staff.data ?? []).find((s) => s.id === selected.id) : undefined;

  const dist =
    me && selected ? formatDistance(distanceKm(me, { lat: selected.lat, lng: selected.lng })) : null;

  return (
    <>
      <AppHeader title="Map" subtitle="Hotels and staff around you" />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        <Card className="shadow-card space-y-3 p-4">
          <div className="flex items-center gap-2">
            {(["all", "hotel", "staff"] as Layer[]).map((l) => (
              <button
                key={l}
                onClick={() => setLayer(l)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${
                  layer === l ? "border-primary bg-accent" : "border-border"
                }`}
              >
                {l === "all" ? "All pins" : l === "hotel" ? t("hotels") : t("staff")}
              </button>
            ))}
            <button
              onClick={locate}
              className="ml-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
            >
              <Navigation className="size-3.5 text-primary" />
              {status === "locating" ? "…" : "GPS"}
            </button>
          </div>
          <div className="h-[380px] overflow-hidden rounded-xl border border-border">
            <ClientOnly
              fallback={<div className="h-full w-full animate-pulse bg-muted" />}
            >
              <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
                <MapCanvas
                  pins={pins}
                  center={me ?? ADDIS}
                  zoom={me ? 13 : 6}
                  selectedId={selected ? `${selected.kind}-${selected.id}` : null}
                  onSelect={setSelected}
                />
              </Suspense>
            </ClientOnly>
          </div>
          <p className="text-xs text-muted-foreground">
            {pins.length} pin{pins.length === 1 ? "" : "s"} · tap a pin to open details
            {me ? " · distances from your GPS location" : ""}
          </p>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.label}</DialogTitle>
            <DialogDescription className="flex items-center gap-1">
              <MapPinIcon className="size-3.5" />
              {hotel?.city ?? person?.city}
              {dist ? ` · ${dist} away` : ""}
            </DialogDescription>
          </DialogHeader>

          {hotel ? (
            <div className="space-y-3">
              {hotel.photo_url ? (
                <MediaImg
                  src={hotel.photo_url}
                  alt={`${hotel.name} in ${hotel.city}`}
                  className="h-40 w-full rounded-xl object-cover"
                />
              ) : null}
              <p className="text-sm text-muted-foreground">{hotel.description}</p>
              <p className="text-sm font-semibold">
                from {formatETB(hotel.price_from)}
                <span className="text-xs font-normal text-muted-foreground"> / night</span>
              </p>
              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <Link to="/hotels">{t("book_now")}</Link>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/pay" search={{ hotel: hotel.id, staff: undefined }}>
                    {t("pay")}
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}

          {person ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {person.position}
                </Badge>
                <span className="flex items-center gap-1 text-sm font-bold">
                  <Star className="size-4 fill-primary text-primary" />
                  {Number(person.rating).toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {person.rating_count} ratings
                </span>
              </div>
              <Button asChild className="w-full">
                <Link
                  to="/pay"
                  search={{
                    hotel: person.hotel_id ?? undefined,
                    staff: person.id,
                  }}

                >
                  Tip {selected?.label}
                </Link>
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
