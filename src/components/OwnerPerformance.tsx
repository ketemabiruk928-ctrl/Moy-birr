import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, TrendingUp, Users, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatETB } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from  "@/components/ui/badge";

type Summary = {
  days: number;
  service_revenue: number;
  payments: number;
  room_revenue: number;
  bookings: number;
  staff_tips_total: number;
  service_rating: number;
  reviews: number;
  lifetime_rating: number;
  lifetime_reviews: number;
  staff_active: number;
  staff_pending: number;
  feedback_new: number;
};

type StaffPerf = {
  staff_profile_id: string;
  full_name: string | null;
  position: string | null;
  employment_status: string;
  avg_stars: number;
  ratings_count: number;
  tips_total: number;
  tips_count: number;
  lifetime_rating: number;
  lifetime_ratings: number;
};

export function OwnerPerformance({ hotelId }: { hotelId: string }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const summary = useQuery({
    queryKey: ["owner-perf-summary", hotelId, days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_performance_summary", {
        _hotel_id: hotelId,
        _days: days,
      });
      if (error) throw error;
      return data as Summary;
    },
  });

  const staff = useQuery({
    queryKey: ["owner-perf-staff", hotelId, days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_staff_performance", {
        _hotel_id: hotelId,
        _days: days,
      });
      if (error) throw error;
      return (data ?? []) as StaffPerf[];
    },
  });

  const s = summary.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([7, 30, 90] as const).map((d) => (
          <Button
            key={d}
            size="sm"
            variant={days === d ? "default" : "outline"}
            onClick={() => setDays(d)}
          >
            Last {d} days
          </Button>
        ))}
      </div>

      {summary.isLoading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Loading performance…
        </Card>
      ) : !s ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No performance data yet.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <TrendingUp className="size-4 text-primary" />
              <p className="mt-2 text-xs text-muted-foreground">Service revenue</p>
              <p className="text-lg font-bold">{formatETB(s.service_revenue)}</p>
              <p className="text-[11px] text-muted-foreground">{s.payments} payments</p>
            </Card>
            <Card className="p-4">
              <Wallet className="size-4 text-primary" />
              <p className="mt-2 text-xs text-muted-foreground">Room revenue</p>
              <p className="text-lg font-bold">{formatETB(s.room_revenue)}</p>
              <p className="text-[11px] text-muted-foreground">{s.bookings} bookings</p>
            </Card>
            <Card className="p-4">
              <Star className="size-4 text-primary" />
              <p className="mt-2 text-xs text-muted-foreground">Service rating</p>
              <p className="text-lg font-bold">
                {Number(s.service_rating ?? 0).toFixed(1)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / 5 · {s.reviews}
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                All-time {Number(s.lifetime_rating ?? 0).toFixed(1)}
              </p>
            </Card>
            <Card className="p-4">
              <Users className="size-4 text-primary" />
              <p className="mt-2 text-xs text-muted-foreground">Team</p>
              <p className="text-lg font-bold">{s.staff_active}</p>
              <p className="text-[11px] text-muted-foreground">
                {s.staff_pending} pending · {s.feedback_new} new msgs
              </p>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Tips earned by your team</p>
              <p className="text-lg font-bold">{formatETB(s.staff_tips_total)}</p>
            </div>
          </Card>

          <p className="pt-2 text-sm font-semibold">Per-staff breakdown</p>
          {staff.isLoading ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Loading…
            </Card>
          ) : (staff.data ?? []).length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No staff yet.
            </Card>
          ) : (
            (staff.data ?? []).map((p) => (
              <Card key={p.staff_profile_id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{p.full_name || "Staff member"}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {p.position || "staff"}
                    </p>
                  </div>
                  <Badge
                    variant={p.employment_status === "active" ? "secondary" : "outline"}
                    className="capitalize"
                  >
                    {p.employment_status}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-[11px] text-muted-foreground">Rating</p>
                    <p className="text-sm font-bold">
                      {p.ratings_count > 0 ? Number(p.avg_stars).toFixed(1) : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-[11px] text-muted-foreground">Lifetime</p>
                    <p className="text-sm font-bold">
                      {p.lifetime_ratings > 0 ? Number(p.lifetime_rating).toFixed(1) : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-[11px] text-muted-foreground">Tips</p>
                    <p className="text-sm font-bold">{formatETB(p.tips_total)}</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </>
      )}
    </div>
  );
}
