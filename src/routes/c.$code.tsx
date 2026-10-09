import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    meta: [
      { title: `${params.code} — Moybirr` },
      { name: "description", content: "Pay or tip at this Moybirr venue." },
    ],
  }),
  component: PublicCardPage,
});

type HotelRow = {
  id: string;
  name: string;
  city: string;
  subcity: string | null;
  description: string | null;
  photo_url: string | null;
  price_from: number;
  rating: number;
  rating_count: number;
  hotel_code: string;
};

const tipPercents = [5, 10, 15];

function PublicCardPage() {
  const { code } = Route.useParams();
  const normalized = code.toUpperCase();

  // Only MH- codes are valid payment points.
  // Everything else (MS-, MG-, MO-, random text) is rejected.
  const isHotel = /^MH-\d+$/i.test(normalized);

  if (!isHotel) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-primary px-6 pt-14 pb-12 text-primary-foreground">
          <div className="mx-auto w-full max-w-lg">
            <p className="text-xs uppercase tracking-wider opacity-80">Moybirr</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Invalid QR</h1>
          </div>
        </div>
        <div className="mx-auto -mt-6 w-full max-w-lg px-4 pb-10">
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            This QR code is not a Moybirr hotel payment code. Only hotel QR
            codes starting with <strong>MH-</strong> are accepted.
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <HotelPayPage code={normalized} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Hotel payment page — reachable by scanning the table QR
// ─────────────────────────────────────────────────────────────────────────

function HotelPayPage({ code }: { code: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [bill, setBill] = useState("");
  const [tip, setTip] = useState("");
  const [staffIdInput, setStaffIdInput] = useState("");
  const [staffStars, setStaffStars] = useState(0);
  const [hotelStars, setHotelStars] = useState(0);
  const [comment, setComment] = useState("");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [staffLookupError, setStaffLookupError] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  const hotel = useQuery({
    queryKey: ["c-hotel", code],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async (): Promise<HotelRow | null> => {
      const { data, error } = await supabase
        .from("hotels_public")
        .select(
          "id, name, city, subcity, description, photo_url, price_from, rating, rating_count, hotel_code",
        )
        .eq("hotel_code", code)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const billNum = Number(bill || 0);
  const tipNum = Number(tip || 0);
  const total = billNum + tipNum;

  const pay = useMutation({
    mutationFn: async () => {
      if (!hotel.data) throw new Error("Hotel not found");
      if (billNum <= 0) throw new Error("Enter the bill amount");

      const { error } = await supabase.rpc("pay_service", {
        _hotel_id: hotel.data.id,
        _staff_profile_id: staffId as unknown as string,
        _amount: billNum,
        _tip: tipNum,
      });
      if (error) throw error;

      if (staffId && staffStars > 0) {
        await supabase.rpc("rate_staff", {
          _staff_profile_id: staffId,
          _booking_id: null as unknown as string,
          _stars: staffStars,
          _comment: staffName ? `Served by ${staffName}` : "",
        });
      }

      if (hotelStars > 0 && user) {
        await supabase.from("hotel_ratings").insert({
          guest_id: user.id,
          hotel_id: hotel.data.id,
          stars: hotelStars,
          comment: comment.trim() || null,
        });
      }
    },
    onSuccess: () => {
      toast.success(
        tipNum > 0
          ? `Paid ${formatETB(total)} — ${formatETB(tipNum)} tip sent to ${staffName || "staff"}. Receipt SMS on its way.`
          : `Paid ${formatETB(total)} — receipt SMS on its way.`,
      );
      setBill("");
      setTip("");
      setStaffIdInput("");
      setStaffId(null);
      setStaffName(null);
      setStaffStars(0);
      setHotelStars(0);
      setComment("");
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lookupStaff = async (input: string) => {
    if (!hotel.data) return;
    const query = input.trim();
    if (!query) {
      setStaffId(null);
      setStaffName(null);
      setStaffLookupError(null);
      return;
    }

    setLookupBusy(true);
    setStaffLookupError(null);

    const asId = query.toUpperCase();
    const { data: byId } = await supabase
      .from("staff_public")
      .select("id, full_name, moybirr_id, position, rating")
      .eq("hotel_id", hotel.data.id)
      .eq("moybirr_id", asId)
      .maybeSingle();

    if (byId) {
      setStaffId(byId.id);
      setStaffName(byId.full_name);
      setLookupBusy(false);
      return;
    }

    const { data: byName } = await supabase
      .from("staff_public")
      .select("id, full_name, moybirr_id, position, rating")
      .eq("hotel_id", hotel.data.id)
      .ilike("full_name", `%${query}%`)
      .limit(1);

    if (byName && byName[0]) {
      setStaffId(byName[0].id);
      setStaffName(byName[0].full_name);
      setStaffLookupError(null);
    } else {
      setStaffId(null);
      setStaffName(null);
      setStaffLookupError("No staff found with that ID or name at this hotel.");
    }
    setLookupBusy(false);
  };

  return (
    <>
      <div className="bg-gradient-primary px-6 pt-14 pb-12 text-primary-foreground">
        <div className="mx-auto w-full max-w-lg">
          <p className="text-xs uppercase tracking-wider opacity-80">Moybirr</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {hotel.data?.name ?? "Loading…"}
          </h1>
          {hotel.data ? (
            <p className="mt-1 flex items-center gap-1 text-sm opacity-90">
              <MapPin className="size-4" />
              {hotel.data.city}
              {hotel.data.subcity ? ` · ${hotel.data.subcity}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto -mt-6 w-full max-w-lg space-y-4 px-4 pb-10">
        {hotel.isLoading ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            Loading…
          </Card>
        ) : hotel.isError ? (
          <Card className="shadow-card p-6 text-center text-sm text-destructive">
            Connection error. Please try again.
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
                className="h-40 w-full rounded-xl object-cover shadow-card"
              />
            ) : null}

            <Card className="shadow-card space-y-2 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm capitalize text-muted-foreground">
                  {hotel.data.description ? "About" : "Venue"}
                </p>
                <Badge variant="secondary">
                  <Star className="mr-1 size-3 fill-primary text-primary" />
                  {Number(hotel.data.rating ?? 0).toFixed(1)} ({hotel.data.rating_count ?? 0})
                </Badge>
              </div>
              {hotel.data.description ? (
                <p className="text-sm text-muted-foreground">{hotel.data.description}</p>
              ) : null}
            </Card>

            <Card className="shadow-card space-y-4 p-5">
              <div className="space-y-1.5">
                <Label htmlFor="bill">
                  Service bill (ETB) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="bill"
                  inputMode="decimal"
                  value={bill}
                  onChange={(e) => setBill(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <p className="text-sm font-semibold">
                  <Gift className="mr-1.5 inline size-4 text-primary" />
                  Add tip <span className="font-normal text-muted-foreground">(optional)</span>
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

              <div className="space-y-1.5">
                <Label htmlFor="staff-id">
                  Staff Moybirr ID{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional — only needed to tip)
                  </span>
                </Label>
                <Input
                  id="staff-id"
                  value={staffIdInput}
                  onChange={(e) => {
                    setStaffIdInput(e.target.value.toUpperCase());
                    setStaffId(null);
                    setStaffName(null);
                    setStaffLookupError(null);
                  }}
                  onBlur={(e) => void lookupStaff(e.target.value)}
                  placeholder="MS-000042 or staff name"
                />
                {lookupBusy ? (
                  <p className="text-xs text-muted-foreground">Looking up…</p>
                ) : staffLookupError ? (
                  <p className="text-xs text-destructive">{staffLookupError}</p>
                ) : staffId && staffName ? (
                  <p className="text-xs text-success">
                    Tipping {staffName} · you can add a rating below
                  </p>
                ) : null}
              </div>

              {staffId ? (
                <div className="space-y-1.5">
                  <Label>
                    Rate {staffName}{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setStaffStars(staffStars === n ? 0 : n)}
                        className="p-0.5"
                      >
                        <Star
                          className={`size-7 ${
                            n <= staffStars
                              ? "fill-primary text-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    ))}
                    {staffStars > 0 ? (
                      <span className="ml-2 self-center text-xs text-muted-foreground">
                        {staffStars}/5
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label>
                  Rate this place{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setHotelStars(hotelStars === n ? 0 : n)}
                      className="p-0.5"
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

              <div className="space-y-1.5">
                <Label htmlFor="comment">
                  Comment{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional note for the owner"
                />
              </div>

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

              {!user ? (
                <>
                  <Button asChild className="w-full" size="lg">
                    <Link to="/auth">Sign in to pay</Link>
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    You'll come right back to this page after signing in.
                  </p>
                </>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  disabled={pay.isPending || billNum <= 0 || !hotel.data}
                  onClick={() => pay.mutate()}
                >
                  {pay.isPending ? "Paying…" : `Pay ${formatETB(total)}`}
                </Button>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}