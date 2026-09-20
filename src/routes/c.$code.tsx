import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Star, IdCard } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatETB } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/c/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.code} — Moybirr` },
      { name: "description", content: "Moybirr public card" },
    ],
  }),
  component: PublicCardPage,
});

type PersonCard = {
  kind: "guest" | "owner" | "staff";
  full_name: string | null;
  moybirr_id: string | null;
  photo_url: string | null;
  position?: string | null;
  rating?: number | null;
  rating_count?: number | null;
  hotel_name?: string | null;
  hotel_city?: string | null;
};

type HotelCard = {
  kind: "hotel";
  name: string;
  city: string;
  subcity: string | null;
  description: string | null;
  photo_url: string | null;
  price_from: number;
  rating: number;
  rating_count: number;
};

function PublicCardPage() {
  const { code } = Route.useParams();
  const normalized = code.toUpperCase();
  const prefix = normalized.slice(0, 2);

  const person = useQuery({
    queryKey: ["c-person", normalized],
    enabled: prefix === "MG" || prefix === "MO" || prefix === "MS",
    queryFn: async (): Promise<PersonCard | null> => {
      if (prefix === "MS") {
        const { data, error } = await supabase
          .from("staff_public")
          .select(
            "full_name, moybirr_id, photo_url, position, rating, rating_count, hotel_name, hotel_city",
          )
          .eq("moybirr_id", normalized)
          .maybeSingle();
        if (error) throw error;
        return data ? { kind: "staff", ...data } : null;
      }

      const { data, error } = await supabase
        .from("profiles_public")
        .select("full_name, moybirr_id, photo_url")
        .eq("moybirr_id", normalized)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        kind: prefix === "MO" ? "owner" : "guest",
        full_name: data.full_name,
        moybirr_id: data.moybirr_id,
        photo_url: data.photo_url,
      };
    },
  });

  const hotel = useQuery({
    queryKey: ["c-hotel", normalized],
    enabled: prefix === "MH",
    queryFn: async (): Promise<HotelCard | null> => {
      const { data, error } = await supabase
        .from("hotels_public")
        .select(
          "name, city, subcity, description, photo_url, price_from, rating, rating_count",
        )
        .eq("hotel_code", normalized)
        .maybeSingle();
      if (error) throw error;
      return data ? { kind: "hotel", ...data } : null;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-primary px-6 pt-14 pb-12 text-primary-foreground">
        <div className="mx-auto w-full max-w-lg">
          <p className="text-xs uppercase tracking-wider opacity-80">Moybirr</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {person.data?.full_name ?? hotel.data?.name ?? "Loading…"}
          </h1>
          <p className="mt-1 font-mono text-sm opacity-90">{normalized}</p>
        </div>
      </div>

      <div className="mx-auto -mt-6 w-full max-w-lg space-y-4 px-4 pb-10">
        {prefix === "MH" ? (
          hotel.isLoading ? (
            <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
              Loading…
            </Card>
          ) : !hotel.data ? (
            <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
              This QR code doesn't match a Moybirr venue.
            </Card>
          ) : (
            <>
              {hotel.data.photo_url ? (
                <img
                  src={hotel.data.photo_url}
                  alt={hotel.data.name}
                  className="h-48 w-full rounded-xl object-cover shadow-card"
                />
              ) : null}
              <Card className="shadow-card space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm capitalize text-muted-foreground">Hotel</p>
                  <Badge variant="secondary">
                    <Star className="mr-1 size-3 fill-primary text-primary" />
                    {Number(hotel.data.rating ?? 0).toFixed(1)} ({hotel.data.rating_count ?? 0})
                  </Badge>
                </div>
                <p className="flex items-center gap-1 text-sm">
                  <MapPin className="size-4 text-muted-foreground" />
                  {hotel.data.city}
                  {hotel.data.subcity ? ` · ${hotel.data.subcity}` : ""}
                </p>
                {hotel.data.description ? (
                  <p className="text-sm text-muted-foreground">{hotel.data.description}</p>
                ) : null}
                {hotel.data.price_from ? (
                  <p className="text-sm font-semibold">
                    from {formatETB(hotel.data.price_from)}
                    <span className="text-xs font-normal text-muted-foreground"> / night</span>
                  </p>
                ) : null}
              </Card>
              <Button asChild className="w-full" size="lg">
                <Link to="/hotels">Open Moybirr to book</Link>
              </Button>
            </>
          )
        ) : null}

        {prefix !== "MH" ? (
          person.isLoading ? (
            <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
              Loading…
            </Card>
          ) : !person.data ? (
            <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
              This QR code doesn't match a Moybirr account.
            </Card>
          ) : (
            <>
              <Card className="shadow-card space-y-4 p-5 text-center">
                {person.data.photo_url ? (
                  <img
                    src={person.data.photo_url}
                    alt={person.data.full_name ?? "User"}
                    className="mx-auto size-24 rounded-full object-cover"
                  />
                ) : null}

                <div>
                  <p className="text-lg font-bold">{person.data.full_name ?? "Moybirr user"}</p>
                  {person.data.kind === "staff" && person.data.position ? (
                    <p className="text-sm capitalize text-muted-foreground">
                      {person.data.position}
                    </p>
                  ) : null}
                </div>

                {person.data.moybirr_id ? (
                  <p className="flex items-center justify-center gap-1 font-mono text-sm text-muted-foreground">
                    <IdCard className="size-4" />
                    {person.data.moybirr_id}
                  </p>
                ) : null}

                {person.data.kind === "staff" ? (
                  <>
                    {person.data.hotel_name ? (
                      <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-4" />
                        {person.data.hotel_name}
                        {person.data.hotel_city ? ` · ${person.data.hotel_city}` : ""}
                      </p>
                    ) : null}
                    <p className="flex items-center justify-center gap-1 text-sm font-semibold">
                      <Star className="size-4 fill-primary text-primary" />
                      {Number(person.data.rating ?? 0).toFixed(1)}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({person.data.rating_count ?? 0} ratings)
                      </span>
                    </p>
                  </>
                ) : null}
              </Card>

              <Card className="shadow-card space-y-3 p-4 text-center">
                <p className="text-sm font-semibold">
                  {person.data.kind === "staff"
                    ? "Open Moybirr to pay or tip"
                    : "Open Moybirr to send money"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sign in to pay{" "}
                  {person.data.full_name?.split(" ")[0] || "this user"} directly from your wallet.
                </p>
                <Button asChild className="w-full" size="lg">
                  <Link to="/auth">Open Moybirr</Link>
                </Button>
              </Card>
            </>
          )
        ) : null}
      </div>
    </div>
  );
}