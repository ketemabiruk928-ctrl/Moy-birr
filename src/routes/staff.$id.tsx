import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Star, IdCard } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/staff/$id")({
  head: () => ({
    meta: [
      { title: "Moybirr staff — scan to pay or tip" },
      { name: "description", content: "Pay or tip this Moybirr staff member." },
    ],
  }),
  component: PublicStaffPage,
});

function PublicStaffPage() {
  const { id } = Route.useParams();

  const staff = useQuery({
    queryKey: ["public-staff", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_public")
        .select(
          "id, position, rating, rating_count, full_name, photo_url, moybirr_id, hotel_name, hotel_city",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-primary px-6 pt-14 pb-12 text-primary-foreground">
        <div className="mx-auto w-full max-w-lg">
          <p className="text-xs uppercase tracking-wider opacity-80">Moybirr</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {staff.data?.full_name ?? "Loading…"}
          </h1>
          {staff.data?.position ? (
            <p className="mt-1 text-sm capitalize opacity-90">{staff.data.position}</p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto -mt-6 w-full max-w-lg space-y-4 px-4 pb-10">
        {staff.isLoading ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            Loading…
          </Card>
        ) : !staff.data ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            This QR code doesn't match a Moybirr staff member.
          </Card>
        ) : (
          <>
            <Card className="shadow-card space-y-4 p-5 text-center">
              {staff.data.photo_url ? (
                <img
                  src={staff.data.photo_url}
                  alt={staff.data.full_name ?? "Staff"}
                  className="mx-auto size-24 rounded-full object-cover"
                />
              ) : null}

              <div>
                <p className="text-lg font-bold">{staff.data.full_name}</p>
                <p className="text-sm capitalize text-muted-foreground">
                  {staff.data.position}
                </p>
              </div>

              {staff.data.moybirr_id ? (
                <p className="flex items-center justify-center gap-1 font-mono text-sm text-muted-foreground">
                  <IdCard className="size-4" />
                  {staff.data.moybirr_id}
                </p>
              ) : null}

              {staff.data.hotel_name ? (
                <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-4" />
                  {staff.data.hotel_name}
                  {staff.data.hotel_city ? ` · ${staff.data.hotel_city}` : ""}
                </p>
              ) : null}

              <p className="flex items-center justify-center gap-1 text-sm font-semibold">
                <Star className="size-4 fill-primary text-primary" />
                {Number(staff.data.rating ?? 0).toFixed(1)}
                <span className="text-xs font-normal text-muted-foreground">
                  ({staff.data.rating_count ?? 0} ratings)
                </span>
              </p>
            </Card>

            <Card className="shadow-card space-y-3 p-4 text-center">
              <p className="text-sm font-semibold">Open Moybirr to pay or tip</p>
              <p className="text-xs text-muted-foreground">
                Sign in to send a tip straight to {staff.data.full_name?.split(" ")[0] || "this staff member"}.
              </p>
              <Button asChild className="w-full" size="lg">
                <Link to="/auth">Open Moybirr</Link>
              </Button>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}