import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Star, Gift } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatETB } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/c/$code")({
  head: ({ params }) => ({
    meta: [{ title: `${params.code} — Moybirr` }],
  }),
  component: HotelPaymentPage,
});

const tipPercents = [5, 10, 15];

function HotelPaymentPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const hotelCode = code.toUpperCase();

  // ----------------------------------------
  // Load hotel from the PUBLIC view
  // ----------------------------------------
  const hotel = useQuery({
    queryKey: ["public-hotel", hotelCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotels_public")
        .select("*")
        .eq("hotel_code", hotelCode)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ----------------------------------------
  // Bill + tip state
  // ----------------------------------------
  const [bill, setBill] = useState("");
  const [tip, setTip] = useState("");
  const [staffId, setStaffId] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffStars, setStaffStars] = useState(0);
  const [hotelStars, setHotelStars] = useState(0);
  const [comment, setComment] = useState("");

  const billNum = Number(bill || 0);
  const tipNum = Number(tip || 0);
  const total = billNum + tipNum;

  // ----------------------------------------
  // Pay
  // ----------------------------------------
  const pay = useMutation({
    mutationFn: async () => {
      if (!hotel.data) throw new Error("Hotel not found");
      if (billNum <= 0) throw new Error("Enter the bill amount");

      const { error } = await supabase.rpc("pay_service", {
        _hotel_id: hotel.data.id,
        _staff_profile_id: staffId || null,
        _amount: billNum,
        _tip: tipNum,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Paid ${formatETB(total)} — receipt on its way.`);
      setBill("");
      setTip("");
      setStaffId("");
      setStaffName("");
      setStaffStars(0);
      setHotelStars(0);
      setComment("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePayClick = () => {
    if (!user) {
      // Remember where they were headed
      sessionStorage.setItem("moybirr_return_to", `/c/${hotelCode}`);
      navigate({ to: "/auth" });
      return;
    }
    pay.mutate();
  };

  // ----------------------------------------
  // RENDER — Loading
  // ----------------------------------------
  if (hotel.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // ----------------------------------------
  // RENDER — Hotel not found
  // ----------------------------------------
  if (!hotel.data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-primary px-6 pt-14 pb-12 text-primary-foreground">
          <p className="text-xs uppercase tracking-wider opacity-80">Moybirr</p>
          <h1 className="mt-2 text-3xl font-bold">Invalid QR code</h1>
        </div>
        <div className="mx-auto -mt-6 w-full max-w-lg px-4 pb-10">
          <Card className="shadow-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              This QR code doesn't match a Moybirr hotel.
            </p>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              {hotelCode}
            </p>
            <Button asChild className="mt-4 w-full">
              <Link to="/">Back to home</Link>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // ----------------------------------------
  // RENDER — Payment page
  // ----------------------------------------
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-primary px-6 pt-14 pb-12 text-primary-foreground">
        <p className="text-xs uppercase tracking-wider opacity-80">Moybirr</p>
        <h1 className="mt-2 text-3xl font-bold">{hotel.data.name}</h1>
        {hotel.data.city ? (
          <p className="mt-1 flex items-center gap-1 text-sm opacity-90">
            <MapPin className="size-4" />
            {hotel.data.city}
            {hotel.data.subcity ? ` · ${hotel.data.subcity}` : ""}
          </p>
        ) : null}
      </div>

      <div className="mx-auto -mt-6 w-full max-w-lg space-y-4 px-4 pb-10">
        {/* Bill */}
        <Card className="shadow-card space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="bill">Service bill (ETB)</Label>
            <Input
              id="bill"
              inputMode="decimal"
              value={bill}
              onChange={(e) => setBill(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Tip */}
          <div>
            <p className="text-sm font-semibold">
              <Gift className="mr-1.5 inline size-4 text-primary" />
              Add tip (optional)
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {tipPercents.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    setTip(String(Math.round(billNum * (p / 100) * 100) / 100))
                  }
                  className="rounded-xl border border-border p-2.5 text-sm font-semibold"
                >
                  {p}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTip("")}
                className="rounded-xl border border-border p-2.5 text-sm font-semibold"
              >
                Clear
              </button>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="tip">Custom tip (ETB)</Label>
              <Input
                id="tip"
                inputMode="decimal"
                value={tip}
                onChange={(e) => setTip(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Staff (for tip) */}
          <div className="space-y-1.5">
            <Label htmlFor="staff">Staff ID or name (only needed for tip)</Label>
            <Input
              id="staff"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="MS-000006 or Helen"
            />
          </div>

          {/* Hotel rating */}
          <div className="space-y-1.5">
            <Label>Rate this place (optional)</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setHotelStars(hotelStars === n ? 0 : n)}
                >
                  <Star
                    className={`size-7 ${
                      n <= hotelStars
                        ? "fill-primary text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="rounded-xl bg-muted p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Service bill</span>
              <span>{formatETB(billNum)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tip (100% to staff)</span>
              <span>{formatETB(tipNum)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>Total</span>
              <span>{formatETB(total)}</span>
            </div>
          </div>

          {/* Pay button */}
          <Button
            className="w-full"
            size="lg"
            disabled={pay.isPending || billNum <= 0}
            onClick={handlePayClick}
          >
            {pay.isPending
              ? "Paying…"
              : !user
                ? "Log in to pay"
                : `Pay ${formatETB(total)}`}
          </Button>

          {!user ? (
            <p className="text-center text-[11px] text-muted-foreground">
              You'll need a free Moybirr account to complete payment. It takes
              30 seconds.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}