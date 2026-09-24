import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home,
  BedDouble,
  QrCode,
  Briefcase,
  User,
  LayoutDashboard,
  Users,
  Clapperboard,
  Bell,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { languages, useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { lang, setLang } = useLang();
  const { user } = useAuth();

  const unread = useQuery({
    queryKey: ["unread-notifications", user?.id],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { count } = await supabase
        .from("in_app_notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .is("read_at", null);
      return count ?? 0;
    },
  });

  return (
    <header className="bg-gradient-primary px-5 pt-6 pb-8 text-primary-foreground">
      <div className="mx-auto flex w-full max-w-lg items-start justify-between gap-4">

        {/* LEFT SIDE: Logo, Greeting, Subtitle (Stacked) */}
        <div className="flex flex-col items-start gap-1">
          <img
            src="/logo.png"
            alt="Moybirr"
            className="h-10 w-auto rounded-lg bg-white/95 object-contain p-1"
          />
          <h1 className="text-xl font-bold tracking-tight mt-1">{title}</h1>
          {subtitle ? (
            <p className="text-[11px] opacity-90">{subtitle}</p>
          ) : null}
        </div>

        {/* RIGHT SIDE: Language on top, Notification below (Stacked) */}
        <div className="flex flex-col items-end gap-3">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as typeof lang)}
            aria-label="Language"
            className="rounded-full border border-primary-foreground/40 bg-transparent px-3 py-1 text-[10px] font-semibold text-primary-foreground"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code} className="text-foreground">
                {l.label}
              </option>
            ))}
          </select>

          {user ? (
            <Link
              to="/notifications"
              className="relative flex size-10 items-center justify-center rounded-full border border-primary-foreground/40"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
              {(unread.data ?? 0) > 0 ? (
                <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unread.data! > 99 ? "99+" : unread.data}
                </span>
              ) : null}
            </Link>
          ) : null}
        </div>

      </div>
    </header>
  );
}

export function BottomTabs() {
  const { role } = useAuth();
  const { t } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    { to: "/", icon: Home, label: t("home") },
    { to: "/hotels", icon: BedDouble, label: t("hotels") },
    { to: "/warka", icon: Clapperboard, label: t("warka") },
    { to: "/pay", icon: QrCode, label: t("pay") },
    role === "owner"
      ? { to: "/owner", icon: LayoutDashboard, label: t("dashboard") }
      : role === "staff"
        ? { to: "/jobs", icon: Briefcase, label: t("jobs") }
        : { to: "/staff", icon: Users, label: t("staff") },
    { to: "/profile", icon: User, label: t("profile") },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card">
      <div className="mx-auto flex w-full max-w-lg items-stretch">
        {tabs.map((tab) => {
          const active = pathname === tab.to;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`size-5 ${active ? "" : "opacity-70"}`} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto w-full max-w-lg">{children}</div>
      <BottomTabs />
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-muted-foreground">Please log in to continue.</p>
        <Button asChild>
          <Link to="/auth">Go to login</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}