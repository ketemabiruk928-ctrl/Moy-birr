import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Wallet, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, phoneToEmail, useAuth, type Role } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
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

const roles: { value: Role; label: string; hint: string }[] = [
  { value: "guest", label: "Guest / Customer", hint: "Pay bills, tip staff, book hotels" },
  { value: "staff", label: "Staff", hint: "Receive tips straight to your wallet" },
  { value: "owner", label: "Hotel Owner", hint: "List rooms, hire staff, see revenue" },
];

function AuthPage() {
  const { t } = useLang();
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

  const login = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error("Could not log in. Check your phone number and password.");
      return;
    }
    await refresh();
    toast.success("Welcome back to Moybirr");
    void navigate({ to: "/" });
  };

  const register = async () => {
    const digits = phone.replace(/\D/g, "");

    // Temporary: only authorized phone can create accounts
    const allowed = ["0963154217", "963154217", "251963154217"];
    if (!allowed.includes(digits)) {
      toast.error("New account registration is temporarily closed. Only authorized numbers can register.");
      return;
    }

    if (digits.length < 9) {
      toast.error("Enter a valid Ethiopian phone number");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (role === "staff") {
      if (!staffCity.trim() || !staffSubcity.trim() || !staffHotelName.trim() || !staffHotelCode.trim()) {
        toast.error("Staff must fill city, subcity, hotel name and Hotel ID");
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
    toast.success("Account created — your wallet is ready!");
    void navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-primary px-6 pt-14 pb-12 text-primary-foreground">
        <div className="mx-auto w-full max-w-lg">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-foreground/15">
            <Wallet className="size-7" />
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">Moybirr</h1>
          <p className="mt-2 max-w-xs text-sm opacity-90">{t("app_tagline")}</p>
          <p className="mt-1 text-xs opacity-75">by Biruk Ketema</p>
        </div>
      </div>

      <div className="mx-auto -mt-6 w-full max-w-lg px-4 pb-10">
        <Card className="shadow-card p-5">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t("login")}</TabsTrigger>
              <TabsTrigger value="register">{t("register")}</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="lphone">{t("phone")}</Label>
                <Input
                  id="lphone"
                  inputMode="tel"
                  placeholder="09xx xxx xxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lpass">{t("password")}</Label>
                <Input
                  id="lpass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button className="w-full" size="lg" disabled={busy} onClick={login}>
                {t("login")}
              </Button>
            </TabsContent>

            <TabsContent value="register" className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="rname">{t("full_name")}</Label>
                <Input id="rname" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rphone">{t("phone")}</Label>
                <Input
                  id="rphone"
                  inputMode="tel"
                  placeholder="09xx xxx xxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rpass">{t("password")}</Label>
                <Input
                  id="rpass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("role")}</Label>
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
                  <p className="text-xs font-semibold text-muted-foreground">Staff workplace details</p>
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input value={staffCity} onChange={(e) => setStaffCity(e.target.value)} placeholder="Addis Ababa" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subcity</Label>
                    <Input value={staffSubcity} onChange={(e) => setStaffSubcity(e.target.value)} placeholder="Bole" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Current hotel / workplace name</Label>
                    <Input
                      value={staffHotelName}
                      onChange={(e) => setStaffHotelName(e.target.value)}
                      placeholder="Hotel name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hotel ID (from owner / Moybirr)</Label>
                    <Input
                      value={staffHotelCode}
                      onChange={(e) => setStaffHotelCode(e.target.value.toUpperCase())}
                      placeholder="MH-000001"
                    />
                  </div>
                </div>
              ) : null}

              <Button className="w-full" size="lg" disabled={busy} onClick={register}>
                {t("register")}
              </Button>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
                Your phone number is your Moybirr ID. A free wallet is created automatically.
              </p>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
              
