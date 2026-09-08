import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Star, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/best-staff")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <BestStaffPage />
      </AppShell>
    </RequireAuth>
  ),
});

type RatingRow = {
  stars: number;
  staff_id: string;
  created_at: string;
  staff_profiles: {
    id: string;
    position: string | null;
    workplace_hotel_name: string | null;
    city: string | null;
    rating: number;
    rating_count: number;
    profiles: { full_name?: string } | null;
    hotels: { name?: string; city?: string } | null;
  } | null;
};

function BestStaffPage() {
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);

  const weekly = useQuery({
    queryKey: ["best-staff-weekly", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ratings")
        .select(
          "stars, staff_id, created_at, staff_profiles:staff_id(id, position, workplace_hotel_name, city, rating, rating_count, profiles:user_id(full_name), hotels:hotel_id(name, city))",
        )
        .gte("created_at", since);
      if (error) throw error;
      return (data ?? []) as RatingRow[];
    },
  });

  const ranked = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        position: string;
        hotel: string;
        city: string;
        sum: number;
        count: number;
      }
    >();

    for (const row of weekly.data ?? []) {
      const sp = row.staff_profiles;
      if (!sp) continue;
      const id = sp.id;
      const cur = map.get(id) ?? {
        id,
        name: sp.profiles?.full_name || "Staff",
        position: sp.position || "staff",
        hotel: sp.hotels?.name || sp.workplace_hotel_name || "Hotel",
        city: sp.hotels?.city || sp.city || "",
        sum: 0,
        count: 0,
      };
      cur.sum += Number(row.stars) || 0;
      cur.count += 1;
      map.set(id, cur);
    }

    return Array.from(map.values())
      .map((s) => ({
        ...s,
        avg: s.count ? s.sum / s.count : 0,
      }))
      .sort((a, b) => {
        if (b.avg !== a.avg) return b.avg - a.avg;
        return b.count - a.count;
      })
      .slice(0, 20);
  }, [weekly.data]);

  return (
    <>
      <AppHeader title="Best staff this week" subtitle="Top rated by guests" />

      <div className="-mt-6 space-y-3 px-4 pb-6">
        <Card className="shadow-card flex items-start gap-3 p-4">
          <Trophy className="mt-0.5 size-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Weekly leaders</p>
            <p className="text-xs text-muted-foreground">
              Based on guest ratings from the last 7 days. Name and workplace are shown.
            </p>
          </div>
        </Card>

        {weekly.isLoading ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            Loading weekly ranking...
          </Card>
        ) : ranked.length === 0 ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            No staff ratings this week yet.
          </Card>
        ) : (
          ranked.map((s, index) => (
            <Card key={s.id} className="shadow-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={index < 3 ? "default" : "secondary"}>#{index + 1}</Badge>
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                  </div>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">{s.position}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    {s.hotel}
                    {s.city ? ` · ${s.city}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="flex items-center justify-end gap-1 text-sm font-bold">
                    <Star className="size-4 fill-primary text-primary" />
                    {s.avg.toFixed(1)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{s.count} ratings this week</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
