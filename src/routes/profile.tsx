import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, MapPin, Star, Languages, Navigation, IdCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatETB, languages, useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { MediaImg, UploadButton } from "@/components/Media";
import { TeamChat } from "@/components/TeamChat";
import { TeamMeetings } from "@/components/TeamMeetings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [email, setEmail] = useState((profile as { email?: string | null } | null)?.email ?? "");
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

  const staffAddress = useQuery({
    queryKey: ["my-staff-address", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_addresses")
        .select("wereda, house_number, landmark")
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
      const trimmedEmail = email.trim();
      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error(t("profile_page.error_invalid_email"));
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: name,
          language: lang,
          photo_url: photo || null,
          email: trimmedEmail || null,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("profile_page.profile_updated"));
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
      toast.success(
        t("profile_page.booking_cancelled", { amount: formatETB(refund as number) }),
      );
      void qc.invalidateQueries({ queryKey: ["bookings"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const joinHotel = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.rpc("link_staff_to_hotel_code", {
        _hotel_code: code.trim(),
        _workplace_name: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("profile_page.join_request_sent"));
      setHotelCode("");
      void qc.invalidateQueries({ queryKey: ["my-staff-profile"] });
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
        })
        .eq("user_id", user!.id);
      if (error) throw error;

      const { error: addrErr } = await supabase.from("staff_addresses").upsert(
        {
          user_id: user!.id,
          wereda: payload.wereda || null,
          house_number: payload.house_number || null,
        },
        { onConflict: "user_id" },
      );
      if (addrErr) throw addrErr;
    },
    onSuccess: () => {
      toast.success(t("profile_page.staff_profile_updated"));
      void qc.invalidateQueries({ queryKey: ["my-staff-profile"] });
      void qc.invalidateQueries({ queryKey: ["my-staff-address"] });
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

  const employment = staffProfile.data?.employment_status ?? "unlinked";

  return (
    <>
      <AppHeader
        title={t("profile")}
        subtitle={
          role === "staff" && employment !== "active"
            ? t("profile_page.pending_approval")
            : profile?.moybirr_id
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

          <div className="space-y-1.5">
            <Label htmlFor="pemail">
              {t("profile_page.email")}{" "}
              <span className="font-normal text-muted-foreground">
                ({t("profile_page.email_note")})
              </span>
            </Label>
            <Input
              id="pemail"
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {t("profile_page.email_privacy")}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("profile_page.profile_photo")}</Label>
            {photo ? (
              <MediaImg
                src={photo}
                alt={t("profile_page.profile_photo")}
                className="size-20 rounded-full object-cover"
              />
            ) : null}
            {user ? (
              <UploadButton
                userId={user.id}
                label={t("profile_page.upload_photo")}
                onUploaded={setPhoto}
              />
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
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            disabled={saveProfile.isPending}
            onClick={() => saveProfile.mutate()}
          >
            {t("profile_page.save_profile")}
          </Button>
        </Card>

        {role === "staff" ? (
          <Card className="shadow-card space-y-3 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{t("profile_page.my_staff_profile")}</p>
              <span className="flex items-center gap-1 text-sm font-bold">
                <Star className="size-4 fill-primary text-primary" />
                {Number(staffProfile.data?.rating ?? 0).toFixed(1)}
              </span>
            </div>

            <div className="rounded-xl bg-muted/60 p-3">
              {employment === "active" ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {t("profile_page.you_work_at")}
                  </p>
                  <p className="text-sm font-semibold">
                    {staffProfile.data?.workplace_hotel_name ?? t("profile_page.your_hotel")}
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    {t("profile_page.approved_tips")}
                  </Badge>
                  {profile?.moybirr_id ? (
                    <p className="mt-2 flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      <IdCard className="size-3.5" />
                      {profile.moybirr_id}
                    </p>
                  ) : null}
                </>
              ) : employment === "pending" ? (
                <>
                  <p className="text-sm font-semibold">
                    {t("profile_page.waiting_approval")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("profile_page.pending_hint", {
                      hotel:
                        staffProfile.data?.workplace_hotel_name ?? t("profile_page.a_hotel"),
                    })}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">
                    {t("profile_page.link_workplace")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {employment === "rejected"
                      ? t("profile_page.rejected_hint")
                      : t("profile_page.link_hint")}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="hcode"
                      placeholder="MH-000123"
                      value={hotelCode}
                      onChange={(e) => setHotelCode(e.target.value)}
                    />
                    <Button
                      disabled={!hotelCode.trim() || joinHotel.isPending}
                      onClick={() => joinHotel.mutate(hotelCode)}
                    >
                      {t("profile_page.join")}
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pos">{t("profile_page.position")}</Label>
              <Input
                id="pos"
                placeholder={
                  staffProfile.data?.position ?? t("profile_page.position_placeholder")
                }
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>

            <p className="pt-1 text-xs font-medium text-muted-foreground">
              {t("profile_page.current_workplace")}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="region">{t("profile_page.region")}</Label>
                <Input
                  id="region"
                  placeholder={staffProfile.data?.region ?? "Addis Ababa"}
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">{t("profile_page.city")}</Label>
                <Input
                  id="city"
                  placeholder={staffProfile.data?.city ?? "Addis Ababa"}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subcity">{t("profile_page.subcity")}</Label>
                <Input
                  id="subcity"
                  placeholder={staffProfile.data?.subcity ?? "Bole"}
                  value={subcity}
                  onChange={(e) => setSubcity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wereda">{t("profile_page.wereda")}</Label>
                <Input
                  id="wereda"
                  placeholder={staffAddress.data?.wereda ?? "03"}
                  value={wereda}
                  onChange={(e) => setWereda(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="house">{t("profile_page.house_number")}</Label>
                <Input
                  id="house"
                  placeholder={
                    staffAddress.data?.house_number ?? t("profile_page.optional_label")
                  }
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {t("profile_page.privacy_note")}
            </p>

            <Button
              className="w-full"
              disabled={updateLocation.isPending}
              onClick={() => {
                updateLocation.mutate({
                  lat: staffProfile.data?.lat ?? null,
                  lng: staffProfile.data?.lng ?? null,
                  position_name: position || staffProfile.data?.position || "waiter",
                  region: region || staffProfile.data?.region || "",
                  city: city || staffProfile.data?.city || "Addis Ababa",
                  subcity: subcity || staffProfile.data?.subcity || "",
                  wereda: wereda || staffAddress.data?.wereda || "",
                  house_number: houseNumber || staffAddress.data?.house_number || "",
                });
              }}
            >
              {t("profile_page.save_workplace")}
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
                      wereda: wereda || staffAddress.data?.wereda || "",
                      house_number: houseNumber || staffAddress.data?.house_number || "",
                    }),
                  () => toast.error(t("profile_page.error_gps")),
                );
              }}
            >
              <Navigation className="mr-2 size-4" />
              {t("profile_page.save_with_gps")}
            </Button>

            {staffProfile.data?.lat && employment === "active" ? (
              <p className="text-xs text-muted-foreground">
                <MapPin className="mr-1 inline size-3" />
                {Number(staffProfile.data.lat).toFixed(3)},{" "}
                {Number(staffProfile.data.lng).toFixed(3)} · {staffProfile.data.rating_count}{" "}
                {t("profile_page.ratings")}
              </p>
            ) : null}
          </Card>
        ) : null}

        {/* Team chat + meetings — visible to approved staff only */}
        {role === "staff" &&
        employment === "active" &&
        staffProfile.data?.hotel_id ? (
          <Card className="shadow-card space-y-3 p-5">
            <div>
              <p className="text-sm font-semibold">{t("profile_page.my_workplace")}</p>
              <p className="text-xs text-muted-foreground">
                {t("profile_page.workplace_desc")}
              </p>
            </div>
            <Tabs defaultValue="chat">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="chat">{t("owner_dashboard.tab_team")}</TabsTrigger>
                <TabsTrigger value="meetings">{t("owner_dashboard.tab_meetings")}</TabsTrigger>
              </TabsList>
              <TabsContent value="chat" className="mt-3">
                <TeamChat hotelId={staffProfile.data.hotel_id} />
              </TabsContent>
              <TabsContent value="meetings" className="mt-3">
                <TeamMeetings hotelId={staffProfile.data.hotel_id} canSchedule={false} />
              </TabsContent>
            </Tabs>
          </Card>
        ) : null}

        <div>
          <h2 className="mb-2 px-1 text-sm font-semibold">{t("my_bookings")}</h2>
          <div className="space-y-3">
            {(bookings.data ?? []).length === 0 ? (
              <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
                {t("profile_page.no_bookings")}
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
                        {t(`status.${b.status}`) || b.status}
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
                        {t("staff_actions.rate_hotel")}
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
          {t("auth.logout")}
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
      toast.success(t("rating.success"));
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
          <DialogTitle>{t("staff_actions.rate_hotel")}</DialogTitle>
          <DialogDescription>{t("rating.desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Stars value={hotelStars} onChange={setHotelStars} />

          <div className="space-y-2">
            <Label>{t("staff_actions.rate_staff")}</Label>
            {(staff.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("rating.no_staff")}</p>
            ) : (
              (staff.data ?? []).map((s) => {
                const p = s.profiles as { full_name?: string } | null;
                return (
                  <div key={s.id} className="rounded-xl border border-border p-3">
                    <p className="text-sm font-medium">
                      {p?.full_name || t("staff_member")}
                    </p>
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
            <Label htmlFor="cmt">{t("rating.comment")}</Label>
            <Textarea id="cmt" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>

          <Button
            className="w-full"
            disabled={submit.isPending}
            onClick={() => submit.mutate()}
          >
            {t("wallet.confirm")}
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
            className={`size-7 ${
              n <= value ? "fill-primary text-primary" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}