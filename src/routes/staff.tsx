import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Star, Navigation, Map as MapIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { distanceKm, formatDistance, useMyLocation } from "@/lib/geo";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TipQr } from "@/components/TipQr";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Find & Tip Hospitality Staff — Moybirr" },
      {
        name: "description",
        content:
          "Browse Ethiopian hotel and restaurant staff by city and rating. See waiters, receptionists and housekeepers with their average 1-5 star guest rating.",
      },
      { property: "og:title", content: "Staff Directory — Moybirr" },
      {
        property: "og:description",
        content: "Filter hospitality staff by location and guest rating.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <StaffPage />
      </AppShell>
    </RequireAuth>
  ),
});

function StaffPage() {
  const { t } = useLang();
  const [city, setCity] = useState("");
  const [minRating, setMinRating] = useState(0);
  const { coords: me, status, locate } = useMyLocation();
  const [nearFirst, setNearFirst] = useState(true);

  const staff = useQuery({
    queryKey: ["staff-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select(
          "id,position,city,rating,rating_count,lat,lng,hotel_id, profiles:user_id(full_name,phone,moybirr_id), hotels:hotel_id(name)",
        )
        .order("rating", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = (staff.data ?? [])
    .filter(
      (s) => s.city.toLowerCase().includes(city.toLowerCase()) && Number(s.rating) >= minRating,
    )
    .map((s) => ({
      ...s,
      dist: me && s.lat != null && s.lng != null ? distanceKm(me, { lat: s.lat, lng: s.lng }) : null,
    }))
    .sort((a, b) =>
      me && nearFirst ? (a.dist ?? 1e9) - (b.dist ?? 1e9) : Number(b.rating) - Number(a.rating),
    );

  return (
    <>
      <AppHeader title={t("staff")} subtitle="Rated by real guests" />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        <Card className="shadow-card space-y-3 p-4">
          <Input
            placeholder="Filter by city (Addis Ababa, Hawassa…)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <div className="flex items-center gap-2">
            {[0, 3, 4, 4.5].map((r) => (
              <button
                key={r}
                onClick={() => setMinRating(r)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  minRating === r ? "border-primary bg-accent" : "border-border"
                }`}
              >
                {r === 0 ? "All" : `${r}+ ★`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={locate}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
            >
              <Navigation className="size-3.5 text-primary" />
              {status === "locating" ? "Locating…" : me ? "Refresh GPS" : "Use my location"}
            </button>
            <button
              onClick={() => setNearFirst((v) => !v)}
              disabled={!me}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                me && nearFirst ? "border-primary bg-accent" : "border-border"
              }`}
            >
              Nearest first
            </button>
            <Link
              to="/map"
              className="ml-auto flex items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary"
            >
              <MapIcon className="size-3.5" />
              Map view
            </Link>
          </div>
        </Card>

        {list.length === 0 ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            No staff match your filters yet.
          </Card>
        ) : (
          list.map((s) => {
            const p = s.profiles as { full_name?: string; moybirr_id?: string } | null;
            const h = s.hotels as { name?: string } | null;
            const name = p?.full_name || "Staff member";
            return (
              <Card key={s.id} className="shadow-card space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-11">
                    <AvatarFallback className="bg-accent text-accent-foreground">
                      {name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    {p?.moybirr_id ? (
                      <p className="text-[11px] font-bold text-primary">{p.moybirr_id}</p>
                    ) : null}
                    <p className="truncate text-xs capitalize text-muted-foreground">
                      {s.position} {h?.name ? `· ${h.name}` : ""}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {s.city}
                      {s.dist != null ? ` · ${formatDistance(s.dist)} away` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="flex items-center justify-end gap-1 text-sm font-bold">
                      <Star className="size-4 fill-primary text-primary" />
                      {Number(s.rating).toFixed(1)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{s.rating_count} ratings</p>
                  </div>
                </div>
                <TipQr
                  title={`Tip ${name}`}
                  description={`Send a tip directly to ${name}'s Moybirr wallet`}
                  hotelId={s.hotel_id ?? undefined}
                  staffId={s.id}
                />
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
          
