import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { QrCode, Star, Gift, Navigation, Search, X, UserCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatETB, useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { QrScanButton } from "@/components/QrScanner";
import { useMyLocation } from "@/lib/geo";

export const Route = createFileRoute("/pay")({
  head: () => ({
    meta: [
      { title: "Scan, Pay & Tip — Moybirr" },
      {
        name: "description",
        content:
          "Scan a hotel or restaurant QR code, pay the service bill and tip the staff member who served you.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <PayPage />
      </AppShell>
    </RequireAuth>
  ),
});

const tipPercents = [5, 10, 15];

type Hotel = {
  id: string;
  name: string;
  city: string | null;
  hotel_code: string | null;
};

type Staff = {
  id: string;
  full_name: string | null;
  moybirr_id: string | null;
  position: string | null;
  rating: number | null;
  rating_count: number | null;
};

function PayPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { status, locate } = useMyLocation();

  // -------- Selected hotel + staff --------
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);

  // -------- Hotel search --------
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Hotel[]>([]);

  // -------- Bill / tip / ratings --------
  const [bill, setBill] = useState("");
  const [tip, setTip] = useState("");
  const [stars, setStars] = useState(0);
  const [hotelStars, setHotelStars] = useState(0);
  const [comment, setComment] = useState("");

  const billNum = Number(bill || 0);
  const tipNum = Number(tip || 0);
  const total = billNum + tipNum;

  // -------- Search hotels manually --------
  const runSearch = async () => {
    const q = searchQ.trim();
    if (q.length < 3) return;
    setSearching(true);
    const qUpper = q.toUpperCase();

    // Try code first
    const byCode = await supabase
      .from("hotels_public")
      .select("id,name,city,hotel_code")
      .ilike("hotel_code", qUpper)
      .limit(5);

    if (byCode.data && byCode.data.length > 0) {
      setSearchResults(byCode.data as Hotel[]);
      setSearching(false);
      return;
    }

    // Then name
    const byName = await supabase
      .from("hotels_public")
      .select("id,name,city,hotel_code")
      .ilike("name", `%${q}%`)
      .limit(5);

    setSearchResults((byName.data ?? []) as Hotel[]);
    setSearching(false);
  };

  // -------- Load staff for selected hotel --------
  const staffQuery = useQuery({
    queryKey: ["pay-staff", hotel?.id],
    enabled: !!hotel?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_public")
        .select("id,full_name,moybirr_id,position,rating,rating_count")
        .eq("hotel_id", hotel!.id)
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Staff[];
    },
  });

  // -------- Wallet balance --------
  const wallet = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // -------- Pay --------
  const pay = useMutation({
    mutationFn: async () => {
      if (!hotel) throw new Error("Select a hotel first");
      if (billNum <= 0) throw new Error("Enter a bill amount");
      if (tipNum > 0 && !staff) throw new Error("Select a staff member for the tip");

      const { error } = await supabase.rpc("pay_service", {
        _hotel_id: hotel.id,
        _staff_profile_id: staff?.id ?? null,
        _amount: billNum,
        _tip: tipNum,
      });
      if (error) throw error;

      if (staff && stars > 0) {
        await supabase.rpc("rate_staff", {
          _staff_profile_id: staff.id,
          _booking_id: null as unknown as string,
          _stars: stars,
          _comment: staff.full_name ? `Served by ${staff.full_name}` : "",
        });
      }

      if (hotelStars > 0 && user) {
        await supabase.from("hotel_ratings").insert({
          guest_id: user.id,
          hotel_id: hotel.id,
          stars: hotelStars,
          comment: comment.trim() || null,
        });
      }
    },
    onSuccess: () => {
      toast.success(`Paid ${formatETB(total)} — thank you!`);
      setBill("");
      setTip("");
      setStars(0);
      setHotelStars(0);
      setComment("");
      setStaff(null);
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleQr = async (text: string) => {
    // Extract MH-XXXXXX from QR text
    const m = text.match(/MH-\d+/i);
    if (!m) {
      toast.error("This QR code isn't a Moybirr hotel code");
      return;
    }
    const code = m[0].toUpperCase();
    const { data } = await supabase
      .from("hotels_public")
      .select("id,name,city,hotel_code")
      .eq("hotel_code", code)
      .maybeSingle();
    if (!data) {
      toast.error("Hotel not found");
      return;
    }
    setHotel(data as Hotel);
    setStaff(null);
    setSearchQ("");
    setSearchResults([]);
    toast.success(`Hotel set: ${data.name}`);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      <AppHeader
        title={t("wallet.scan_pay")}
        subtitle={`${t("wallet.balance")}: ${formatETB(wallet.data?.balance)}`}
      />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        {/* -------- HOTEL SELECTION -------- */}
        <Card className="shadow-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-accent">
              <QrCode className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Scan QR or choose hotel</p>
              <p className="text-xs text-muted-foreground">
                Point camera at the table QR, or search below
              </p>
            </div>
          </div>

          <div className="mt-4">
            <QrScanButton onResult={handleQr} label="Open camera & scan" />
          </div>

          <button
            onClick={locate}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-muted p-2.5 text-xs font-medium"
          >
            <Navigation className="size-3.5 text-primary" />
            {status === "locating" ? "Locating…" : "Use my location"}
          </button>

          {/* Selected hotel */}
          {hotel ? (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-primary bg-accent p-3">
              <div>
                <p className="text-sm font-semibold">{hotel.name}</p>
                <p className="text-xs text-muted-foreground">
                  {hotel.city ?? ""} · {hotel.hotel_code ?? ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHotel(null);
                  setStaff(null);
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Clear hotel"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onBlur={runSearch}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="Search hotel name or MH- code"
                />
              </div>

              {searching ? (
                <p className="mt-2 text-xs text-muted-foreground">Searching…</p>
              ) : null}

              {searchResults.length > 0 ? (
                <div className="mt-2 grid gap-2">
                  {searchResults.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        setHotel(h);
                        setStaff(null);
                        setSearchQ("");
                        setSearchResults([]);
                      }}
                      className="rounded-xl border border-primary bg-accent p-3 text-left text-sm"
                    >
                      <span className="font-medium">{h.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {h.city} · {h.hotel_code}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </Card>

        {/* -------- BILL + TIP + STAFF -------- */}
        <Card className="shadow-card space-y-4 p-5">
          {/* Bill */}
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

          {/* -------- STAFF PICKER -------- */}
          <div>
            <Label>
              Who served you?{" "}
              {tipNum > 0 ? (
                <span className="text-destructive">(required for tip)</span>
              ) : (
                <span className="font-normal text-muted-foreground">(optional)</span>
              )}
            </Label>

            {!hotel ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Select a hotel first.
              </p>
            ) : staffQuery.isLoading ? (
              <p className="mt-2 text-xs text-muted-foreground">Loading staff…</p>
            ) : (staffQuery.data ?? []).length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No staff registered at this hotel yet.
              </p>
            ) : (
              <div className="mt-2 grid gap-2">
                {(staffQuery.data ?? []).map((s) => {
                  const isSelected = staff?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStaff(isSelected ? null : s)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-accent"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                          <UserCircle2 className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {s.full_name || "Staff"}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {s.moybirr_id ?? "—"} · {s.position ?? "staff"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="size-3.5 fill-primary text-primary" />
                        <span className="text-sm font-bold">
                          {s.rating != null && Number(s.rating) > 0
                            ? Number(s.rating).toFixed(1)
                            : "New"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rate staff (only if selected) */}
          {staff ? (
            <div className="space-y-1.5">
              <Label>Rate {staff.full_name} (optional)</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setStars(stars === n ? 0 : n)}
                    className="p-0.5"
                  >
                    <Star
                      className={`size-7 ${
                        n <= stars
                          ? "fill-primary text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Rate hotel */}
          <div className="space-y-1.5">
            <Label>Rate this place (optional)</Label>
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
            <Input
              className="mt-2"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional comment"
            />
          </div>

          {/* Total */}
          <div className="rounded-xl bg-muted p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Service bill → hotel</span>
              <span>{formatETB(billNum)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Tip → {staff?.full_name ?? "staff"}
              </span>
              <span>{formatETB(tipNum)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>Total</span>
              <span>{formatETB(total)}</span>
            </div>
          </div>

          {/* Pay */}
          <Button
            className="w-full"
            size="lg"
            disabled={
              pay.isPending ||
              !hotel ||
              total <= 0 ||
              (tipNum > 0 && !staff)
            }
            onClick={() => pay.mutate()}
          >
            {pay.isPending ? "Paying…" : `Pay ${formatETB(total)}`}
          </Button>

          {tipNum > 0 && !staff ? (
            <Badge variant="destructive" className="mt-2">
              Select who served you to send the tip
            </Badge>
          ) : null}
        </Card>
      </div>
    </>
  );
}