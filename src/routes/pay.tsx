import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { QrCode, Star, Gift, Navigation, Search } from "lucide-react";
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
import { distanceKm, formatDistance, useMyLocation } from "@/lib/geo";

export const Route = createFileRoute("/pay")({
  validateSearch: (search: Record<string, unknown>) => ({
    hotel: typeof search['hotel'] === "string" ? search['hotel'] : undefined,
    staff: typeof search['staff'] === "string" ? search['staff'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Scan, Pay & Tip — Moybirr" },
      {
        name: "description",
        content:
          "Scan a hotel or restaurant QR code, pay the service bill from your Moybirr wallet and add a tip that goes 100% to the staff member who served you.",
      },
      { property: "og:title", content: "QR Payment & Tipping — Moybirr" },
      {
        property: "og:description",
        content: "Pay the bill and tip your waiter, receptionist or housekeeper instantly.",
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

/**
 * Parse a QR code value into a hotel or staff identifier.
 *
 * Accepts:
 *   https://moy-birr.vercel.app/staff/<uuid>          → { staff: uuid }
 *   https://moy-birr.vercel.app/h/MH-000001           → { hotel: MH-000001 }
 *   https://moy-birr.vercel.app/pay?hotel=X&staff=Y   → legacy
 *   moybirr://pay/staff/<uuid>                         → legacy
 *   moybirr://pay/hotel/<uuid>                         → legacy
 *   <raw uuid>                                         → assume hotel uuid
 */
function parseQrValue(raw: string): { hotel?: string; staff?: string } | null {
  const text = raw.trim();
  if (!text) return null;

  // Try URL parse first (covers https:// and moybirr://)
  try {
    const url = new URL(text);
    const path = url.pathname.replace(/\/+$/, ""); // strip trailing slashes

    // /staff/<uuid>
    const staffMatch = path.match(/\/staff\/([^/]+)$/);
    if (staffMatch) return { staff: staffMatch[1] };

    // /h/<code-or-uuid>
    const hotelMatch = path.match(/\/h\/([^/]+)$/);
    if (hotelMatch) return { hotel: hotelMatch[1] };

    // legacy: ?hotel=...&staff=...
    const hotel = url.searchParams.get("hotel") ?? undefined;
    const staff = url.searchParams.get("staff") ?? undefined;
    if (hotel || staff) return { ...(hotel ? { hotel } : {}), ...(staff ? { staff } : {}) };
  } catch {
    /* not a URL */
  }

  // Bare UUID → assume hotel
  const uuid = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  if (uuid) return { hotel: uuid[0] };

  // Bare hotel code → e.g. "MH-000001"
  if (/^MH-\d+$/i.test(text)) return { hotel: text.toUpperCase() };

  return null;
}

function PayPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();

  const search = Route.useSearch();
  const [hotelId, setHotelId] = useState<string | null>(search.hotel ?? null);
  const [staffId, setStaffId] = useState<string | null>(search.staff ?? null);
  const [bill, setBill] = useState("");
  const [tip, setTip] = useState("");
  const [hotelQuery, setHotelQuery] = useState("");
  const [showHotelSearch, setShowHotelSearch] = useState(!search.hotel);
  const [staffName, setStaffName] = useState("");
  const [stars, setStars] = useState(0);
  const [hotelStars, setHotelStars] = useState(0);
  const [hotelComment, setHotelComment] = useState("");

  const { coords, status, locate } = useMyLocation();

  // Hotel list for the search dropdown — from the public view (no owner_id, no qr_code).
  const hotels = useQuery({
    queryKey: ["hotels-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotels_public")
        .select("id,name,city,hotel_code")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Staff list for the selected hotel — from the public view.
  // Only name, position, rating are exposed by the view — no phone, no GPS.
  const staff = useQuery({
    queryKey: ["staff-public", hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_public")
        .select("id,position,rating,rating_count,hotel_id,full_name,photo_url,moybirr_id")
        .eq("hotel_id", hotelId!)
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

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

  const billNum = Number(bill || 0);
  const tipNum = Number(tip || 0);
  const total = billNum + tipNum;

  const pay = useMutation({
    mutationFn: async () => {
      if (!hotelId) throw new Error("Scan or search the hotel first");
      const { error } = await supabase.rpc("pay_service", {
        _hotel_id: hotelId,
        _staff_profile_id: staffId as unknown as string,
        _amount: billNum,
        _tip: tipNum,
      });
      if (error) throw error;
      if (staffId && stars > 0) {
        const { error: rateError } = await supabase.rpc("rate_staff", {
          _staff_profile_id: staffId,
          _booking_id: null as unknown as string,
          _stars: stars,
          _comment: staffName ? `Served by ${staffName}` : "",
        });
        if (rateError) throw rateError;
      }

      if (hotelStars > 0) {
        const { data: authData } = await supabase.auth.getUser();
        const guestId = authData.user?.id;
        if (guestId) {
          const { error: hotelRateErr } = await supabase.from("hotel_ratings").insert({
            guest_id: guestId,
            hotel_id: hotelId,
            stars: hotelStars,
            comment: hotelComment.trim() || null,
          });
          if (hotelRateErr) throw hotelRateErr;
        }
      }
    },
    onSuccess: () => {
      toast.success(
        tipNum > 0
          ? `Paid ${formatETB(total)} — ${formatETB(tipNum)} tip sent to ${staffName || "staff"}. SMS sent to both parties.`
          : `Paid ${formatETB(total)} — SMS confirmation sent.`,
      );
      setBill("");
      setTip("");
      setStars(0);
      setHotelStars(0);
      setHotelComment("");
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      void qc.invalidateQueries({ queryKey: ["staff-public"] });
      void qc.invalidateQueries({ queryKey: ["owner-hotel-ratings"] });
      void qc.invalidateQueries({ queryKey: ["hotel-ratings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleScan = async (text: string) => {
    const parsed = parseQrValue(text);
    if (!parsed) {
      toast.error("That QR code is not a Moybirr payment code");
      return;
    }

    // Staff QR scanned first — apply staff, then resolve their hotel.
    if (parsed.staff) {
      setStaffId(parsed.staff);
      // Look up which hotel this staff works at so the hotel field fills in.
      const { data: staffRow, error: staffErr } = await supabase
        .from("staff_public")
        .select("hotel_id,full_name")
        .eq("id", parsed.staff)
        .maybeSingle();
      if (staffErr) {
        toast.error("Could not load that staff member");
        return;
      }
      if (staffRow?.hotel_id) {
        setHotelId(staffRow.hotel_id);
        setShowHotelSearch(false);
        if (staffRow.full_name) setStaffName(staffRow.full_name);
      }
      toast.success(`Staff QR scanned — enter the bill for ${staffRow?.full_name ?? "staff"}`);
      return;
    }

    // Hotel QR — could be a hotel code (MH-000001) or a UUID.
    if (parsed.hotel) {
      const value = parsed.hotel;
      // If it looks like a UUID, it's already the internal id.
      const isUuid = /^[0-9a-f]{8}-/i.test(value);
      if (isUuid) {
        setHotelId(value);
      } else {
        // Hotel code — look up the internal id.
        const { data: hotelRow, error: hotelErr } = await supabase
          .from("hotels_public")
          .select("id,name")
          .eq("hotel_code", value.toUpperCase())
          .maybeSingle();
        if (hotelErr || !hotelRow) {
          toast.error("Hotel not found");
          return;
        }
        setHotelId(hotelRow.id);
      }
      setStaffId(null);
      setStaffName("");
      setShowHotelSearch(false);
      toast.success("Hotel QR scanned");
    }
  };

  const selectedHotel = (hotels.data ?? []).find((h) => h.id === hotelId) ?? null;

  const hotelResults = (() => {
    const q = hotelQuery.trim().toLowerCase();
    const rows = (hotels.data ?? [])
      .filter(
        (h) =>
          !q || h.name.toLowerCase().includes(q) || (h.city ?? "").toLowerCase().includes(q),
      );
    return rows.slice(0, 6);
  })();

  const staffResults = (() => {
    const q = staffName.trim().toLowerCase();
    return (staff.data ?? []).filter((s) => {
      if (!q) return true;
      return (
        (s.full_name ?? "").toLowerCase().includes(q) ||
        (s.position ?? "").toLowerCase().includes(q)
      );
    });
  })();

  return (
    <>
      <AppHeader title={t("scan_pay")} subtitle={`Balance: ${formatETB(wallet.data?.balance)}`} />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        <Card className="shadow-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-accent">
              <QrCode className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Scan the table QR code</p>
              <p className="text-xs text-muted-foreground">
                Point your camera at the hotel QR, or pick the place below.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <QrScanButton onResult={handleScan} label="Open camera & scan" />
          </div>

          <button
            onClick={locate}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-muted p-2.5 text-xs font-medium"
          >
            <Navigation className="size-3.5 text-primary" />
            {status === "locating"
              ? "Finding your location…"
              : status === "ready"
                ? "Sorted by distance from you — refresh GPS"
                : status === "denied"
                  ? "Location blocked — tap to retry"
                  : "Use my GPS to find the nearest place"}
          </button>

          <div className="mt-4 space-y-2">
            <Label>Hotel / Restaurant</Label>
            {selectedHotel && !showHotelSearch ? (
              <div className="flex items-center justify-between rounded-xl border border-primary bg-accent p-3">
                <span className="text-sm">
                  <span className="font-medium">{selectedHotel.name}</span>
                  <span className="text-muted-foreground"> · {selectedHotel.city}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setShowHotelSearch(true)}>
                  Change
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowHotelSearch(true)}
                style={{ display: showHotelSearch ? "none" : undefined }}
              >
                <Search className="mr-2 size-4" />
                {t("search_hotel")}
              </Button>
            )}

            {showHotelSearch ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    className="pl-9"
                    value={hotelQuery}
                    onChange={(e) => setHotelQuery(e.target.value)}
                    placeholder={t("search_hotel")}
                  />
                </div>
                {hotelResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No place matches that name.</p>
                ) : (
                  <div className="grid gap-2">
                    {hotelResults.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => {
                          setHotelId(h.id);
                          setStaffId(null);
                          setStaffName("");
                          setHotelQuery("");
                          setShowHotelSearch(false);
                        }}
                        className={`rounded-xl border p-3 text-left text-sm ${
                          hotelId === h.id ? "border-primary bg-accent" : "border-border"
                        }`}
                      >
                        <span className="font-medium">{h.name}</span>
                        <span className="text-muted-foreground"> · {h.city}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="shadow-card p-5">
          <div className="space-y-1.5">
            <Label htmlFor="bill">{t("service_bill")} (ETB)</Label>
            <Input
              id="bill"
              inputMode="decimal"
              value={bill}
              onChange={(e) => setBill(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold">
              <Gift className="mr-1.5 inline size-4 text-primary" />
              {t("add_tip")}
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {tipPercents.map((p) => (
                <button
                  key={p}
                  onClick={() => setTip(String(Math.round(billNum * (p / 100) * 100) / 100))}
                  className="rounded-xl border border-border p-2.5 text-sm font-semibold"
                >
                  {p}%
                </button>
              ))}
              <button
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

          <div className="mt-5 space-y-2">
            <Label htmlFor="staff-name">{t("staff_name")}</Label>
            <Input
              id="staff-name"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="e.g. Selam T. — waiter"
            />
            <div className="grid gap-2">
              {staffResults.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {(staff.data ?? []).length === 0
                    ? "No staff registered for this place yet."
                    : "No staff matches that name."}
                </p>
              ) : (
                staffResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setStaffId(s.id);
                      setStaffName(s.full_name || "Staff member");
                    }}
                    className={`flex items-center justify-between rounded-xl border p-3 text-left ${
                      staffId === s.id ? "border-primary bg-accent" : "border-border"
                    }`}
                  >
                    <span>
                      <span className="text-sm font-medium">
                        {s.full_name || "Staff member"}
                      </span>
                      <span className="block text-xs text-muted-foreground capitalize">
                        {s.position}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold">
                      <Star className="size-3.5 fill-primary text-primary" />
                      {Number(s.rating).toFixed(1)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="mt-5">
            <Label>Rate this hotel / place</Label>
            <div className="mt-2 flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} hotel stars`}
                  onClick={() => setHotelStars(hotelStars === n ? 0 : n)}
                  className="p-0.5"
                >
                  <Star
                    className={`size-7 ${n <= hotelStars ? "fill-primary text-primary" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
              {hotelStars > 0 ? (
                <span className="text-xs text-muted-foreground">{hotelStars}/5</span>
              ) : null}
            </div>
            <Input
              className="mt-2"
              value={hotelComment}
              onChange={(e) => setHotelComment(e.target.value)}
              placeholder="Optional comment for the hotel owner"
            />
          </div>

          <div className="mt-5">
            <Label>
              {t("rate_staff")} {staffName ? `— ${staffName}` : ""}
            </Label>
            <div className="mt-2 flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  aria-label={`${n} star`}
                  onClick={() => setStars(stars === n ? 0 : n)}
                  className="p-0.5"
                >
                  <Star
                    className={`size-7 ${n <= stars ? "fill-primary text-primary" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
              {stars > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {stars}/5 — saved with your payment
                </span>
              ) : null}
            </div>
            {stars > 0 && !staffId ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Pick the staff member above so your rating reaches them.
              </p>
            ) : null}
          </div>

          <div className="mt-5 rounded-xl bg-muted p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("service_bill")}</span>
              <span>{formatETB(billNum)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tip (100% to staff)</span>
              <span>{formatETB(tipNum)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>{t("total")}</span>
              <span>{formatETB(total)}</span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Moybirr keeps a 3% commission from the service bill. Tips are never touched.
            </p>
          </div>

          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={pay.isPending || total <= 0 || !hotelId}
            onClick={() => pay.mutate()}
          >
            Pay {formatETB(total)}
          </Button>
          {tipNum > 0 && !staffId ? (
            <Badge variant="secondary" className="mt-3">
              Select a staff member to receive the tip
            </Badge>
          ) : null}
        </Card>
      </div>
    </>
  );
}