import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Star, Navigation, Map as MapIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatETB, useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { distanceKm, formatDistance, useMyLocation } from "@/lib/geo";
import { MediaImg, MediaVideo } from "@/components/Media";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/hotels")({
  head: () => ({
    meta: [
      { title: "Book Ethiopian Hotels with Your Wallet — Moybirr" },
      {
        name: "description",
        content:
          "Browse hotels in Addis Ababa, Hawassa, Gondar, Mekelle and Bahir Dar, see guest hospitality ratings, and pay for your room straight from your Moybirr wallet.",
      },
      { property: "og:title", content: "Hotel Booking — Moybirr" },
      {
        property: "og:description",
        content: "Photos, prices, GPS distance and 1-5 star hospitality ratings for every hotel.",
      },
      {
        property: "og:image",
        content: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200",
      },
      {
        name: "twitter:image",
        content: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <HotelsPage />
      </AppShell>
    </RequireAuth>
  ),
});

function HotelsPage() {
  const { t } = useLang();
  const { coords: me, status, locate } = useMyLocation();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [nearFirst, setNearFirst] = useState(true);

  const hotels = useQuery({
    queryKey: ["hotels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hotels").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ratings = useQuery({
    queryKey: ["hotel-ratings-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hotel_ratings").select("hotel_id,stars");
      if (error) throw error;
      return data ?? [];
    },
  });

  const avgFor = (hotelId: string) => {
    const rows = (ratings.data ?? []).filter((r) => r.hotel_id === hotelId);
    if (!rows.length) return null;
    return rows.reduce((s, r) => s + r.stars, 0) / rows.length;
  };

  const list = (hotels.data ?? [])
    .filter(
      (h) =>
        h.name.toLowerCase().includes(query.toLowerCase()) ||
        h.city.toLowerCase().includes(query.toLowerCase()),
    )
    .map((h) => ({
      ...h,
      dist: me && h.lat != null && h.lng != null ? distanceKm(me, { lat: h.lat, lng: h.lng }) : null,
    }))
    .sort((a, b) =>
      me && nearFirst ? (a.dist ?? 1e9) - (b.dist ?? 1e9) : a.name.localeCompare(b.name),
    );

  return (
    <>
      <AppHeader title={t("hotels")} subtitle="Book with your wallet, rate the hospitality" />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        <Card className="shadow-card p-4">
          <Input
            placeholder="Search hotel or city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-3 flex items-center gap-2">
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
          <p className="mt-2 text-xs text-muted-foreground">
            {me
              ? "Distances measured from your GPS location"
              : status === "denied"
                ? "Location blocked in your browser — enable it to see distances"
                : "Allow location to see how far each hotel is"}
          </p>
        </Card>

        {list.map((h) => {
          const avg = avgFor(h.id);
          const dist = h.dist;
          return (
            <Card key={h.id} className="shadow-card overflow-hidden p-0">
              <MediaImg
                src={h.photo_url}
                alt={`${h.name} in ${h.city}`}
                className="h-40 w-full object-cover"
              />
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{h.name}</h2>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3.5" />
                      {h.city}
                      {dist != null ? ` · ${formatDistance(dist)} away` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    <Star className="mr-1 size-3 fill-primary text-primary" />
                    {avg ? avg.toFixed(1) : "New"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{h.description}</p>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-sm font-semibold">
                    from {formatETB(h.price_from)}
                    <span className="text-xs font-normal text-muted-foreground"> / night</span>
                  </p>
                  <Button size="sm" onClick={() => setSelected(h.id)}>
                    {t("book_now")}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <BookingDialog hotelId={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function BookingDialog({ hotelId, onClose }: { hotelId: string | null; onClose: () => void }) {
  const { t } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);

  const rooms = useQuery({
    queryKey: ["rooms", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("hotel_id", hotelId!)
        .order("price");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hotelId,
  });

  const media = useQuery({
    queryKey: ["hotel-media", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_media")
        .select("id,kind,url,caption")
        .eq("hotel_id", hotelId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hotelId,
  });

  const reviews = useQuery({
    queryKey: ["hotel-reviews", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_ratings")
        .select("id,stars,comment,created_at")
        .eq("hotel_id", hotelId!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hotelId,
  });


  const room = (rooms.data ?? []).find((r) => r.id === roomId);
  const nights = Math.max(
    1,
    Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000),
  );
  const total = room ? Number(room.price) * nights : 0;

  const book = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("book_hotel", {
        _room_id: roomId!,
        _check_in: checkIn,
        _check_out: checkOut,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking confirmed — confirmation SMS sent");
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["bookings"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!hotelId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("book_now")}</DialogTitle>
          <DialogDescription>Pay from your Moybirr wallet. Free cancellation up to 24h before check-in.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {(media.data ?? []).length > 0 ? (
            <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
              {(media.data ?? []).map((m) => (
                <figure key={m.id} className="w-52 shrink-0 snap-start">
                  {m.kind === "video" ? (
                    <MediaVideo
                      src={m.url}
                      className="h-32 w-52 rounded-xl bg-muted object-cover"
                    />
                  ) : (
                    <MediaImg
                      src={m.url}
                      alt={m.caption ?? "Hotel service"}
                      className="h-32 w-52 rounded-xl object-cover"
                    />
                  )}
                  {m.caption ? (
                    <figcaption className="mt-1 text-[11px] text-muted-foreground">
                      {m.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Room type</Label>
            {(rooms.data ?? []).map((r) => (
              <button
                key={r.id}
                onClick={() => setRoomId(r.id)}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${
                  roomId === r.id ? "border-primary bg-accent" : "border-border"
                }`}
              >
                <span>
                  <span className="text-sm font-medium">{r.room_type}</span>
                  <span className="block text-xs text-muted-foreground">
                    Up to {r.capacity} guests
                  </span>
                </span>
                <span className="text-sm font-semibold">{formatETB(r.price)}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ci">{t("check_in")}</Label>
              <Input
                id="ci"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co">{t("check_out")}</Label>
              <Input
                id="co"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl bg-muted p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {nights} night{nights > 1 ? "s" : ""}
              </span>
              <span>{room ? formatETB(room.price) : "—"}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-bold">
              <span>{t("total")}</span>
              <span>{formatETB(total)}</span>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!roomId || !user || book.isPending}
            onClick={() => book.mutate()}
          >
            Pay {formatETB(total)} from wallet
          </Button>

          {(reviews.data ?? []).length > 0 ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-semibold">{t("rate_hotel")} · guest reviews</p>
              {(reviews.data ?? []).map((r) => (
                <div key={r.id} className="rounded-xl bg-muted p-3">
                  <p className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`size-3.5 ${
                          i < r.stars ? "fill-primary text-primary" : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </p>
                  {r.comment ? <p className="mt-1 text-xs">{r.comment}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
