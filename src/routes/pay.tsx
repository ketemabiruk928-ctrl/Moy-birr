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
import { useMyLocation } from "@/lib/geo";

export const Route = createFileRoute("/pay")({
  validateSearch: (search: Record<string, unknown>) => ({
    hotel: typeof search["hotel"] === "string" ? search["hotel"] : undefined,
    staff: typeof search["staff"] === "string" ? search["staff"] : undefined,
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

type ParsedQr =
  | { kind: "hotel"; code: string }
  | { kind: "staff"; code: string }
  | { kind: "person"; code: string }
  | null;

function parseQrValue(raw: string): ParsedQr {
  const text = raw.trim();
  if (!text) return null;

  try {
    const url = new URL(text);
    const path = url.pathname.replace(/\/+$/, "");

    const cMatch = path.match(/\/c\/([A-Za-z]{2}-\d+)$/);
    if (cMatch) {
      const code = cMatch[1].toUpperCase();
      const prefix = code.slice(0, 2);
      if (prefix === "MS") return { kind: "staff", code };
      if (prefix === "MH") return { kind: "hotel", code };
      if (prefix === "MG" || prefix === "MO") return { kind: "person", code };
      return null;
    }

    const staffMatch = path.match(/\/staff\/([^/]+)$/);
    if (staffMatch) return { kind: "staff", code: staffMatch[1] };

    const hotelMatch = path.match(/\/h\/([^/]+)$/);
    if (hotelMatch) return { kind: "hotel", code: hotelMatch[1] };

    const hotel = url.searchParams.get("hotel") ?? undefined;
    const staff = url.searchParams.get("staff") ?? undefined;
    if (staff) return { kind: "staff", code: staff };
    if (hotel) return { kind: "hotel", code: hotel };
  } catch {
    /* not a URL */
  }

  const uuid = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  if (uuid) return { kind: "hotel", code: uuid[0] };

  if (/^MH-\d+$/i.test(text)) return { kind: "hotel", code: text.toUpperCase() };
  if (/^MS-\d+$/i.test(text)) return { kind: "staff", code: text.toUpperCase() };

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

  const { status, locate } = useMyLocation();

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
      if (!hotelId) throw new Error(t("pay.error_scan_hotel"));
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
          ? t("pay.success_with_tip", {
              total: formatETB(total),
              tip: formatETB(tipNum),
              staff: staffName || t("staff_member"),
            })
          : t("pay.success_no_tip", { total: formatETB(total) }),
      );
      setBill("");
      setTip("");
      setStars(0);
      setHotelStars(0);
      setHotelComment("");
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      void qc.invalidateQueries({ queryKey: ["staff-public"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleScan = async (text: string) => {
    const parsed = parseQrValue(text);
    if (!parsed) {
      toast.error(t("pay.error_invalid_qr"));
      return;
    }

    if (parsed.kind === "hotel") {
      if (/^MH-/i.test(parsed.code)) {
        window.location.href = `/c/${parsed.code.toUpperCase()}`;
        return;
      }
      const { data } = await supabase
        .from("hotels_public")
        .select("hotel_code")
        .eq("id", parsed.code)
        .maybeSingle();
      if (data?.hotel_code) {
        window.location.href = `/c/${data.hotel_code.toUpperCase()}`;
        return;
      }
      toast.error(t("pay.error_hotel_not_found"));
      return;
    }

    if (parsed.kind === "person") {
      toast.info(t("pay.info_person_qr", { code: parsed.code }));
      return;
    }

    if (parsed.kind === "staff") {
      const code = parsed.code;
      const isUuid = /^[0-9a-f]{8}-/i.test(code);

      let staffRow: {
        id: string;
        hotel_id: string | null;
        full_name: string | null;
      } | null = null;

      if (isUuid) {
        const { data } = await supabase
          .from("staff_public")
          .select("id,hotel_id,full_name")
          .eq("id", code)
          .maybeSingle();
        staffRow = data;
      } else {
        const { data } = await supabase
          .from("staff_public")
          .select("id,hotel_id,full_name")
          .eq("moybirr_id", code.toUpperCase())
          .maybeSingle();
        staffRow = data;
      }

      if (!staffRow) {
        toast.error(t("pay.error_staff_not_found"));
        return;
      }

      setStaffId(staffRow.id);
      if (staffRow.hotel_id) setHotelId(staffRow.hotel_id);
      setShowHotelSearch(false);
      if (staffRow.full_name) setStaffName(staffRow.full_name);
      toast.success(
        t("pay.success_staff_qr", {
          staff: staffRow.full_name ?? t("staff_member"),
        }),
      );
    }
  };

  const selectedHotel = (hotels.data ?? []).find((h) => h.id === hotelId) ?? null;

  const hotelResults = (() => {
    const q = hotelQuery.trim().toLowerCase();
    const rows = (hotels.data ?? []).filter((h) => {
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        (h.city ?? "").toLowerCase().includes(q) ||
        (h.hotel_code ?? "").toLowerCase().includes(q)
      );
    });
    return rows.slice(0, 6);
  })();

  const staffResults = (() => {
    const q = staffName.trim().toLowerCase();
    return (staff.data ?? []).filter((s) => {
      if (!q) return true;
      return (
        (s.full_name ?? "").toLowerCase().includes(q) ||
        (s.position ?? "").toLowerCase().includes(q) ||
        (s.moybirr_id ?? "").toLowerCase().includes(q)
      );
    });
  })();

  return (
    <>
      <AppHeader
        title={t("wallet.scan_pay")}
        subtitle={`${t("wallet.balance")}: ${formatETB(wallet.data?.balance)}`}
      />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        <Card className="shadow-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-accent">
              <QrCode className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t("pay.scan_title")}</p>
              <p className="text-xs text-muted-foreground">{t("pay.scan_desc")}</p>
            </div>
          </div>

          <div className="mt-4">
            <QrScanButton onResult={handleScan} label={t("pay.open_camera")} />
          </div>

          <button
            onClick={locate}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-muted p-2.5 text-xs font-medium"
          >
            <Navigation className="size-3.5 text-primary" />
            {status === "locating"
              ? t("pay.locating")
              : status === "ready"
                ? t("pay.sorted_by_distance")
                : status === "denied"
                  ? t("pay.location_blocked")
                  : t("pay.use_gps")}
          </button>

          <div className="mt-4 space-y-2">
            <Label>{t("pay.hotel_label")}</Label>
            {selectedHotel && !showHotelSearch ? (
              <div className="flex items-center justify-between rounded-xl border border-primary bg-accent p-3">
                <span className="text-sm">
                  <span className="font-medium">{selectedHotel.name}</span>
                  <span className="text-muted-foreground"> · {selectedHotel.city}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setShowHotelSearch(true)}>
                  {t("pay.change")}
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
                    placeholder={t("pay.hotel_search_placeholder")}
                  />
                </div>
                {hotelResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("pay.no_hotel_match")}</p>
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
                        {h.hotel_code ? (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {h.hotel_code}
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
            <Label htmlFor="bill">{t("staff_actions.service_bill")} (ETB)</Label>
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
              {t("staff_actions.add_tip")}
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
                {t("pay.clear")}
              </button>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="tip">{t("pay.custom_tip")}</Label>
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
            <Label htmlFor="staff-name">{t("pay.staff_id_label")}</Label>
            <Input
              id="staff-name"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value.toUpperCase())}
              placeholder={t("pay.staff_id_placeholder")}
            />
            <div className="grid gap-2">
              {staffResults.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {(staff.data ?? []).length === 0
                    ? t("pay.no_staff_registered")
                    : t("pay.no_staff_match")}
                </p>
              ) : (
                staffResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setStaffId(s.id);
                      setStaffName(s.moybirr_id ?? s.full_name ?? t("staff_member"));
                    }}
                    className={`flex items-center justify-between rounded-xl border p-3 text-left ${
                      staffId === s.id ? "border-primary bg-accent" : "border-border"
                    }`}
                  >
                    <span>
                      <span className="text-sm font-medium">
                        {s.full_name || t("staff_member")}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {s.moybirr_id}
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
            <Label>{t("pay.rate_hotel_label")}</Label>
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
                    className={`size-7 ${
                      n <= hotelStars ? "fill-primary text-primary" : "text-muted-foreground"
                    }`}
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
              placeholder={t("pay.hotel_comment_placeholder")}
            />
          </div>

          <div className="mt-5">
            <Label>
              {t("staff_actions.rate_staff")} {staffName ? `— ${staffName}` : ""}
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
                    className={`size-7 ${
                      n <= stars ? "fill-primary text-primary" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
              {stars > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {stars}/5 — {t("pay.saved_with_payment")}
                </span>
              ) : null}
            </div>
            {stars > 0 && !staffId ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("pay.pick_staff_hint")}
              </p>
            ) : null}
          </div>

          <div className="mt-5 rounded-xl bg-muted p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("staff_actions.service_bill")}
              </span>
              <span>{formatETB(billNum)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("pay.tip_to_staff")}</span>
              <span>{formatETB(tipNum)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>{t("booking.total")}</span>
              <span>{formatETB(total)}</span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t("pay.commission_note")}
            </p>
          </div>

          <Button
            className="mt-4 w-full"
            size="lg"
            disabled={pay.isPending || total <= 0 || !hotelId}
            onClick={() => pay.mutate()}
          >
            {t("pay.pay_amount", { amount: formatETB(total) })}
          </Button>
          {tipNum > 0 && !staffId ? (
            <Badge variant="secondary" className="mt-3">
              {t("pay.select_staff_for_tip")}
            </Badge>
          ) : null}
        </Card>
      </div>
    </>
  );
}