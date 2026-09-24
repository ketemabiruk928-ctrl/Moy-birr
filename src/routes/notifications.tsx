import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/notifications")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <NotificationsPage />
      </AppShell>
    </RequireAuth>
  ),
});

type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link_to: string | null;
  read_at: string | null;
  created_at: string;
};

function NotificationsPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("in_app_notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("in_app_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("in_app_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("notifications.all_read"));
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = list.data ?? [];
  const hasUnread = rows.some((r) => !r.read_at);

  return (
    <>
      <AppHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
      />

      <div className="-mt-6 space-y-3 px-4 pb-6">
        {hasUnread ? (
          <Button
            variant="outline"
            className="w-full"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck className="mr-2 size-4" />
            {t("notifications.mark_all_read")}
          </Button>
        ) : null}

        {list.isLoading ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            {t("notifications.loading")}
          </Card>
        ) : rows.length === 0 ? (
          <Card className="shadow-card flex flex-col items-center gap-2 p-6 text-center">
            <Bell className="size-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("notifications.empty")}</p>
          </Card>
        ) : (
          rows.map((n) => {
            const unread = !n.read_at;
            const inner = (
              <Card
                className={`shadow-card space-y-1 p-4 ${
                  unread ? "border-primary/40 bg-accent/40" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <div className="flex items-center gap-1">
                    {unread ? (
                      <Badge variant="default">{t("notifications.new")}</Badge>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </Card>
            );

            if (n.link_to) {
              return (
                <Link
                  key={n.id}
                  to={n.link_to}
                  className="block"
                  onClick={() => markRead.mutate(n.id)}
                >
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead.mutate(n.id)}
                className="block w-full text-left"
              >
                {inner}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}