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
import { distanceKm, formatDistance, parsePayCode, useMyLocation } from "@/lib/geo";

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

  const { coords, status, locate } = useMyLocation();

  const hotels = useQuery({
    queryKey: ["hotels-simple"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotels")
        .select("id,name,city,lat,lng")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const staff = useQuery({
    queryKey: ["staff-of-hotel", hotelId],
    queryFn: async () => {
      let q = supabase
        .from("staff_profiles")
        .select("id,user_id,position,rating,rating_count,hotel_id, profiles:user_id(full_name,moybirr_id)");
      if (hotelId) q = q.eq("hotel_id", hotelId);
      const { data, error } = await q.limit(30);
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
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      void qc.invalidateQueries({ queryKey: ["staff-of-hotel"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleScan = (text: string) => {
    const parsed = parsePayCode(text);
    if (!parsed) {
      toast.error("That QR code is not a Moybirr payment code");
      return;
    }
    if (parsed.hotel) {
      setHotelId(parsed.hotel);
      setShowHotelSearch(false);
    }
    if (parsed.staff) setStaffId(parsed.staff);
    else if (parsed.hotel) setStaffId(null);
    toast.success(parsed.staff ? "Staff QR scanned — enter the bill" : "Hotel QR scanned");
  };

  const selectedHotel = (hotels.data ?? []).find((h) => h.id === hotelId) ?? null;

  const hotelResults = (() => {
    const q = hotelQuery.trim().toLowerCase();
    const rows = (hotels.data ?? [])
      .map((h) => ({
        ...h,
        dist:
          coords && h.lat != null && h.lng != null
            ? distanceKm(coords, { lat: h.lat, lng: h.lng })
            : null,
      }))
      .filter(
        (h) =>
          !q || h.name.toLowerCase().includes(q) || (h.city ?? "").toLowerCase().includes(q),
      );
    if (coords) rows.sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9));
    return rows.slice(0, 6);
  })();

  const staffResults = (() => {
    const q = staffName.trim().toLowerCase();
    return (staff.data ?? []).filter((s) => {
      if (!q) return true;
      const p = s.profiles as { full_name?: string } | null;
      return (
        (p?.full_name ?? "").toLowerCase().includes(q) ||
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
                        {h.dist != null ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {formatDistance(h.dist)} away
                          </span>
                        ) : null}
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
            <Label htmlFor="staff-id-input">Staff Moybirr ID</Label>
            <Input
              id="staff-id-input"
              placeholder="e.g. MS-000001"
              onChange={async (e) => {
                const val = e.target.value.toUpperCase().trim();
                if (!val) { setStaffId(null); setStaffName(""); return; }
                const { data } = await supabase
                  .from("staff_profiles")
                  .select("id, position, profiles:user_id(full_name, moybirr_id)")
                  .eq("hotel_id", hotelId ?? "")
                  .limit(50);
                const match = (data ?? []).find((s) => {
                  const p = s.profiles as { moybirr_id?: string; full_name?: string } | null;
                  return p?.moybirr_id === val;
                });
                if (match) {
                  const p = match.profiles as { full_name?: string } | null;
                  setStaffId(match.id);
                  setStaffName(p?.full_name || "Staff member");
                }
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Enter the waiter's Moybirr ID to send the tip directly to their wallet.
            </p>
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
                staffResults.map((s) => {
                  const p = s.profiles as { full_name?: string; moybirr_id?: string } | null;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setStaffId(s.id);
                        setStaffName(p?.full_name || "Staff member");
                      }}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left ${
                        staffId === s.id ? "border-primary bg-accent" : "border-border"
                      }`}
                    >
                      <span>
                        <span className="text-sm font-medium">{p?.full_name || "Staff member"}</span>
                        {p?.moybirr_id ? (
                          <span className="ml-2 text-[11px] font-bold text-primary">{p.moybirr_id}</span>
                        ) : null}
                        <span className="block text-xs text-muted-foreground capitalize">
                          {s.position}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold">
                        <Star className="size-3.5 fill-primary text-primary" />
                        {Number(s.rating).toFixed(1)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
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
    

  
              

          
