import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatETB, useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/bookings")({
  head: () => ({
    meta: [{ title: "Booking History — Moybirr" }],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <BookingHistoryPage />
      </AppShell>
    </RequireAuth>
  ),
});

function BookingHistoryPage() {
  const { t } = useLang();
  const { user } = useAuth();

  const bookings = useQuery({
    queryKey: ["bookings-all", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, hotels:hotel_id(name,city)")
        .eq("guest_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = (bookings.data ?? []).filter(
    (b) => b.status !== "cancelled" && b.status !== "completed",
  );
  const past = (bookings.data ?? []).filter(
    (b) => b.status === "cancelled" || b.status === "completed",
  );

  return (
    <>
      <AppHeader
        title="Booking History"
        subtitle={`${(bookings.data ?? []).length} bookings`}
      />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/profile">
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Link>
        </Button>

        {bookings.isLoading ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            Loading…
          </Card>
        ) : (bookings.data ?? []).length === 0 ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            {t("profile_page.no_bookings")}
          </Card>
        ) : (
          <>
            {active.length > 0 ? (
              <>
                <h2 className="px-1 text-sm font-semibold">Active ({active.length})</h2>
                {active.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </>
            ) : null}

            {past.length > 0 ? (
              <>
                <h2 className="px-1 pt-4 text-sm font-semibold">
                  Past / Cancelled ({past.length})
                </h2>
                {past.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function BookingCard({ booking }: { booking: any }) {
  const { t } = useLang();
  const hotel = booking.hotels as { name?: string; city?: string } | null;

  return (
    <Card className="shadow-card space-y-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{hotel?.name || "Hotel"}</p>
          {hotel?.city ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              {hotel.city}
            </p>
          ) : null}
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            {booking.check_in} → {booking.check_out}
          </p>
          <p className="text-xs text-muted-foreground">{booking.room_type}</p>
        </div>
        <Badge
          variant={
            booking.status === "cancelled"
              ? "destructive"
              : booking.status === "completed"
                ? "secondary"
                : "default"
          }
          className="shrink-0 capitalize"
        >
          {t(`status.${booking.status}`) || booking.status}
        </Badge>
      </div>

      <p className="text-sm font-semibold">{formatETB(booking.total)}</p>
    </Card>
  );
}