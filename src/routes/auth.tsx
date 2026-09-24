import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, phoneToEmail, useAuth, type Role } from "@/lib/auth";
import { useLang, languages } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Log in or register — Moybirr" },
      {
        name: "description",
        content:
          "Create your free Moybirr wallet with your Ethiopian phone number as a guest, staff member or hotel owner.",
      },
      { property: "og:title", content: "Join Moybirr" },
      {
        property: "og:description",
        content: "Register with your phone number and get a free digital wallet instantly.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, lang, setLang } = useLang();
  const { session, refresh } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("guest");

  // Staff workplace fields
  const [staffCity, setStaffCity] = useState("");
  const [staffSubcity, setStaffSubcity] = useState("");
  const [staffHotelName, setStaffHotelName] = useState("");
  const [staffHotelCode, setStaffHotelCode] = useState("");

  if (session) {
    void navigate({ to: "/" });
  }

  // Build role options from translations
  const roles: { value: Role; label: string; hint: string }[] = [
    {
      value: "guest",
      label: t("role_guest"),
      hint: t("role_guest_hint"),
    },
    {
      value: "staff",
      label: t("role_staff"),
      hint: t("role_staff_hint"),
    },
    {
      value: "owner",
      label: t("role_owner"),
      hint: t("role_owner_hint"),
    },
  ];

  const login = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error(t("error_login"));
      return;
    }
    await refresh();
    toast.success(t("success_welcome_back"));
    void navigate({ to: "/" });
  };

  const register = async () => {
    const digits = phone.replace(/\D/g, "");

    const allowed = [
      "0963154217", "963154217", "251963154217",
      "0904170140", "904170140", "251904170140",
      "0913968525", "913968525", "251913968525",
    ];
    if (!allowed.includes(digits)) {
      toast.error(t("error_registration_closed"));
      return;
    }

    if (digits.length < 9) {
      toast.error(t("error_invalid_phone"));
      return;
    }
    if (password.length < 6) {
      toast.error(t("error_password_short"));
      return;
    }

    if (role === "staff") {
      if (!staffCity.trim() || !staffSubcity.trim() || !staffHotelName.trim() || !staffHotelCode.trim()) {
        toast.error(t("error_staff_fields"));
        return;
      }
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: phoneToEmail(phone),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name, phone: normalizePhone(phone), role },
      },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    if (!data.session) {
      await supabase.auth.signInWithPassword({ email: phoneToEmail(phone), password });
    }

    await supabase.rpc("ensure_my_account", {
      _full_name: name,
      _phone: normalizePhone(phone),
      _role: role,
    });

    if (role === "staff") {
      const { error: linkErr } = await supabase.rpc("link_staff_to_hotel_code", {
        _hotel_code: staffHotelCode.trim(),
        _workplace_name: staffHotelName.trim(),
      });
      if (linkErr) {
        setBusy(false);
        toast.error(linkErr.message);
        return;
      }

      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        await supabase
          .from("staff_profiles")
          .update({
            city: staffCity.trim(),
            subcity: staffSubcity.trim(),
            workplace_hotel_name: staffHotelName.trim(),
            hotel_code: staffHotelCode.trim().toUpperCase(),
          })
          .eq("user_id", uid);
      }
    }

    setBusy(false);
    await refresh();
    toast.success(t("success_account_created"));
    void navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-primary px-6 pt-14 pb-12 text-primary-foreground">
        <div className="mx-auto w-full max-w-lg">
          {/* Language picker at the top right */}
          <div className="flex justify-end">
            <div className="flex items-center gap-1.5 rounded-full border border-primary-foreground/40 bg-transparent px-3 py-1">
              <Globe className="size-3.5" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as typeof lang)}
                aria-label="Language"
                className="bg-transparent text-xs font-semibold text-primary-foreground outline-none"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code} className="text-foreground">
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <img src="/logo.png" alt="Moybirr" className="h-14 w-auto mt-2" />
          <h1 className="mt-5 text-3xl font-bold tracking-tight">{t("auth.app_title")}</h1>
          <p className="mt-2 max-w-xs text-sm opacity-90">{t("app_tagline")}</p>
          <p className="mt-1 text-xs opacity-75">{t("auth.app_author")}</p>
        </div>
      </div>

      <div className="mx-auto -mt-6 w-full max-w-lg px-4 pb-10">
        <Card className="shadow-card p-5">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t("auth.login")}</TabsTrigger>
              <TabsTrigger value="register">{t("auth.register")}</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="lphone">{t("auth.phone")}</Label>
                <Input
                  id="lphone"
                  inputMode="tel"
                  placeholder="09xx xxx xxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lpass">{t("auth.password")}</Label>
                <Input
                  id="lpass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button className="w-full" size="lg" disabled={busy} onClick={login}>
                {t("auth.login")}
              </Button>
            </TabsContent>

            <TabsContent value="register" className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="rname">{t("auth.full_name")}</Label>
                <Input id="rname" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rphone">{t("auth.phone")}</Label>
                <Input
                  id="rphone"
                  inputMode="tel"
                  placeholder="09xx xxx xxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rpass">{t("auth.password")}</Label>
                <Input
                  id="rpass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("auth.role_label")}</Label>
                <div className="grid gap-2">
                  {roles.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        role === r.value
                          ? "border-primary bg-accent"
                          : "border-border bg-card hover:bg-muted"
                      }`}
                    >
                      <p className="text-sm font-semibold">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.hint}</p>
                    </button>
                  ))}
                </div>
              </div>

              {role === "staff" ? (
                <div className="space-y-3 rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t("auth.staff_workplace")}
                  </p>
                  <div className="space-y-1.5">
                    <Label>{t("auth.city")}</Label>
                    <Input
                      value={staffCity}
                      onChange={(e) => setStaffCity(e.target.value)}
                      placeholder="Addis Ababa"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("auth.subcity")}</Label>
                    <Input
                      value={staffSubcity}
                      onChange={(e) => setStaffSubcity(e.target.value)}
                      placeholder="Bole"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("auth.workplace_name")}</Label>
                    <Input
                      value={staffHotelName}
                      onChange={(e) => setStaffHotelName(e.target.value)}
                      placeholder="Hotel name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("auth.hotel_id")}</Label>
                    <Input
                      value={staffHotelCode}
                      onChange={(e) => setStaffHotelCode(e.target.value.toUpperCase())}
                      placeholder="MH-000001"
                    />
                  </div>
                </div>
              ) : null}

              <Button className="w-full" size="lg" disabled={busy} onClick={register}>
                {t("auth.register")}
              </Button>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
                {t("auth.wallet_notice")}
              </p>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}