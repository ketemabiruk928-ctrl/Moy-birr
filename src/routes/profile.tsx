import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, MapPin, Star, Languages, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatETB, languages, useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { MediaImg, UploadButton } from "@/components/Media";
import { TipQr } from "@/components/TipQr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/profile")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <ProfilePage />
      </AppShell>
    </RequireAuth>
  ),
});

function ProfilePage() {
  const { t, lang, setLang } = useLang();
  const { user, profile, role, refresh, signOut } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [photo, setPhoto] = useState(profile?.photo_url ?? "");
  const [rating, setRating] = useState<{ bookingId: string; hotelId: string } | null>(null);

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

  const staffProfile = useQuery({
    queryKey: ["my-staff-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && role === "staff",
  });

  const bookings = useQuery({
    queryKey: ["bookings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, hotels:hotel_id(name,city)")
        .eq("guest_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name, language: lang, photo_url: photo || null })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Profile updated");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("cancel_booking", { _booking_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: (refund) => {
      toast.success(`Booking cancelled — ${formatETB(refund as number)} refunded`);
      void qc.invalidateQueries({ queryKey: ["bookings"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLocation = useMutation({
    mutationFn: async (payload: {
      lat: number | null;
      lng: number | null;
      position_name: string;
      region: string;
      city: string;
      subcity: string;
      wereda: string;
      house_number: string;
      hotel_code: string;
    }) => {
      const { error } = await supabase
        .from("staff_profiles")
        .update({
          lat: payload.lat,
          lng: payload.lng,
          position: payload.position_name,
          region: payload.region || null,
          city: payload.city,
          subcity: payload.subcity || null,
          wereda: payload.wereda || null,
          house_number: payload.house_number || null,
          hotel_code: payload.hotel_code || null,
        })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Staff profile updated");
      void qc.invalidateQueries({ queryKey: ["my-staff-profile"] });
      void qc.invalidateQueries({ queryKey: ["staff-directory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [position, setPosition] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [subcity, setSubcity] = useState("");
  const [wereda, setWereda] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [hotelCode, setHotelCode] = useState("");

  return (
    <>
      <AppHeader
        title={t("profile")}
        subtitle={
          profile?.moybirr_id
            ? profile.moybirr_id + (profile?.phone ? " · " + profile.phone : "")
            : (profile?.phone ?? "")
        }
      />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        <Card className="shadow-card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("balance")}
              </p>
              <p className="text-xl font-bold">{formatETB(wallet.data?.balance)}</p>
            </div>
            <Badge variant="secondary" className="capitalize">
              {role}
            </Badge>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pname">{t("full_name")}</Label>
            <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Profile photo</Label>
            {photo ? (
              <MediaImg src={photo} alt="Profile photo" className="size-20 rounded-full object-cover" />
            ) : null}
            {user ? (
              <UploadButton userId={user.id} label="Upload profile photo" onUploaded={setPhoto} />
            ) : null}
          </div>

          <div className="rounded-xl bg-muted p-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Languages className="size-4 text-primary" />
              {t("language")}
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    lang === l.code ? "bg-primary text-primary-foreground" : "bg-card"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
            Save profile
          </Button>
        </Card>

        {role === "staff" ? (
          <Card className="shadow-card space-y-3 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">My staff profile</p>
              <span className="flex items-center gap-1 text-sm font-bold">
                <Star className="size-4 fill-primary text-primary" />
                {Number(staffProfile.data?.rating ?? 0).toFixed(1)}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pos">Position</Label>
              <Input
                id="pos"
                placeholder={staffProfile.data?.position ?? "waiter"}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>

            <p className="pt-1 text-xs font-medium text-muted-foreground">
              Current working place
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  placeholder={staffProfile.data?.region ?? "Addis Ababa"}
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder={staffProfile.data?.city ?? "Addis Ababa"}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subcity">Subcity</Label>
                <Input
                  id="subcity"
                  placeholder={staffProfile.data?.subcity ?? "Bole"}
                  value={subcity}
                  onChange={(e) => setSubcity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wereda">Wereda</Label>
                <Input
                  id="wereda"
                  placeholder={staffProfile.data?.wereda ?? "03"}
                  value={wereda}
                  onChange={(e) => setWereda(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="house">House number</Label>
                <Input
                  id="house"
                  placeholder={staffProfile.data?.house_number ?? "Optional"}
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hcode">Hotel code (Moybirr)</Label>
                <Input
                  id="hcode"
                  placeholder={staffProfile.data?.hotel_code ?? "e.g. MO-000123"}
                  value={hotelCode}
                  onChange={(e) => setHotelCode(e.target.value)}
                />
              </div>
            </div>

            <Button
              className="w-full"
              disabled={updateLocation.isPending}
              onClick={() => {
                const payload = {
                  lat: staffProfile.data?.lat ?? null,
                  lng: staffProfile.data?.lng ?? null,
                  position_name: position || staffProfile.data?.position || "waiter",
                  region: region || staffProfile.data?.region || "",
                  city: city || staffProfile.data?.city || "Addis Ababa",
                  subcity: subcity || staffProfile.data?.subcity || "",
                  wereda: wereda || staffProfile.data?.wereda || "",
                  house_number: houseNumber || staffProfile.data?.house_number || "",
                  hotel_code: hotelCode || staffProfile.data?.hotel_code || "",
                };
                updateLocation.mutate(payload);
              }}
            >
              Save working place
            </Button>

            <Button
              variant="secondary"
              className="w-full"
              disabled={updateLocation.isPending}
              onClick={() => {
                navigator.geolocation.getCurrentPosition(
                  (p) =>
                    updateLocation.mutate({
                      lat: p.coords.latitude,
                      lng: p.coords.longitude,
                      position_name: position || staffProfile.data?.position || "waiter",
                      region: region || staffProfile.data?.region || "",
                      city: city || staffProfile.data?.city || "Addis Ababa",
                      subcity: subcity || staffProfile.data?.subcity || "",
                      wereda: wereda || staffProfile.data?.wereda || "",
                      house_number: houseNumber || staffProfile.data?.house_number || "",
                      hotel_code: hotelCode || staffProfile.data?.hotel_code || "",
                    }),
                  () => toast.error("Could not read your GPS location"),
                );
              }}
            >
              <Navigation className="mr-2 size-4" />
              Save + update with my GPS location
            </Button>

            {staffProfile.data?.lat ? (
              <p className="text-xs text-muted-foreground">
                <MapPin className="mr-1 inline size-3" />
                {Number(staffProfile.data.lat).toFixed(3)},{" "}
                {Number(staffProfile.data.lng).toFixed(3)} · {staffProfile.data.rating_count} ratings
              </p>
            ) : null}
          </Card>
        ) : null}

        {role === "staff" && staffProfile.data ? (
          <TipQr
            title="My tip QR code"
            description="Show this to guests — they scan it, pay the bill and 100% of the tip lands in your wallet."
            hotelId={staffProfile.data.hotel_id}
            staffId={staffProfile.data.id}
          />
        ) : null}

        <div>
          <h2 className="mb-2 px-1 text-sm font-semibold">{t("my_bookings")}</h2>
          <div className="space-y-3">
            {(bookings.data ?? []).length === 0 ? (
              <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
                No bookings yet.
              </Card>
            ) : (
              (bookings.data ?? []).map((b) => {
                const h = b.hotels as { name?: string; city?: string } | null;
                return (
                  <Card key={b.id} className="shadow-card space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{h?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.room_type} · {b.check_in} → {b.check_out}
                        </p>
                      </div>
                      <Badge variant={b.status === "cancelled" ? "destructive" : "secondary"}>
                        {b.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold">{formatETB(b.total)}</p>
                    <div className="flex gap-2">
                      {b.status === "confirmed" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancel.mutate(b.id)}
                          disabled={cancel.isPending}
                        >
                          {t("cancel")}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        onClick={() => setRating({ bookingId: b.id, hotelId: b.hotel_id })}
                      >
                        {t("rate_staff")}
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={() => void signOut()}>
          <LogOut className="mr-2 size-4" />
          {t("logout")}
        </Button>
      </div>

      <RatingDialog data={rating} onClose={() => setRating(null)} />
    </>
  );
}

function RatingDialog({
  data,
  onClose,
}: {
  data: { bookingId: string; hotelId: string } | null;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [hotelStars, setHotelStars] = useState(5);
  const [comment, setComment] = useState("");
  const [staffStars, setStaffStars] = useState<Record<string, number>>({});

  const staff = useQuery({
    queryKey: ["staff-of-booking", data?.hotelId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("staff_profiles")
        .select("id,position, profiles:user_id(full_name)")
        .eq("hotel_id", data!.hotelId);
      if (error) throw error;
      return rows ?? [];
    },
    enabled: !!data,
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hotel_ratings").insert({
        guest_id: user!.id,
        hotel_id: data!.hotelId,
        booking_id: data!.bookingId,
        stars: hotelStars,
        comment: comment || null,
      });
      if (error) throw error;

      for (const [staffId, stars] of Object.entries(staffStars)) {
        const { error: e2 } = await supabase.rpc("rate_staff", {
          _staff_profile_id: staffId,
          _booking_id: data!.bookingId,
          _stars: stars,
          _comment: comment,
        });
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("Thank you! Your ratings are now visible to every guest.");
      void qc.invalidateQueries({ queryKey: ["hotel-ratings-all"] });
      void qc.invalidateQueries({ queryKey: ["staff-directory"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("rate_hotel")}</DialogTitle>
          <DialogDescription>
            Rate the hospitality from 1 to 5 stars. Every guest can see these ratings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Stars value={hotelStars} onChange={setHotelStars} />

          <div className="space-y-2">
            <Label>{t("rate_staff")}</Label>
            {(staff.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No staff registered for this hotel yet.
              </p>
            ) : (
              (staff.data ?? []).map((s) => {
                const p = s.profiles as { full_name?: string } | null;
                return (
                  <div key={s.id} className="rounded-xl border border-border p-3">
                    <p className="text-sm font-medium">{p?.full_name || "Staff member"}</p>
                    <p className="text-xs capitalize text-muted-foreground">{s.position}</p>
                    <Stars
                      value={staffStars[s.id] ?? 0}
                      onChange={(v) => setStaffStars((prev) => ({ ...prev, [s.id]: v }))}
                    />
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cmt">Comment</Label>
            <Textarea id="cmt" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>

          <Button className="w-full" disabled={submit.isPending} onClick={() => submit.mutate()}>
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="mt-1 flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}>
          <Star
            className={`size-7 ${n <= value ? "fill-primary text-primary" : "text-muted-foreground"}`}
          />
        </button>
      ))}
    </div>
  );
}             
