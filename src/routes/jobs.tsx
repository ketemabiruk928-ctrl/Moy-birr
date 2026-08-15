import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Briefcase, MapPin, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatETB, useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Hospitality Jobs in Ethiopia — Moybirr" },
      {
        name: "description",
        content:
          "Hotel vacancies posted by verified Ethiopian hotel owners. Staff can apply in one tap with their guest rating attached.",
      },
      { property: "og:title", content: "Job Marketplace — Moybirr" },
      {
        property: "og:description",
        content: "Waiter, receptionist and housekeeping vacancies across Ethiopia.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <JobsPage />
      </AppShell>
    </RequireAuth>
  ),
});

function JobsPage() {
  const { t } = useLang();
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [applying, setApplying] = useState<string | null>(null);

  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, hotels:hotel_id(name)")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const applications = useQuery({
    queryKey: ["my-applications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("job_id,status")
        .eq("staff_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const apply = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("job_applications")
        .insert({ job_id: jobId, staff_id: user!.id, message: "Applied via Moybirr" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application sent to the hotel owner");
      void qc.invalidateQueries({ queryKey: ["my-applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setApplying(null),
  });

  const appliedIds = new Set((applications.data ?? []).map((a) => a.job_id));

  return (
    <>
      <AppHeader title={t("jobs")} subtitle="Vacancies from verified hotel owners" />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        {role === "owner" ? (
          <Card className="shadow-card border-primary/30 bg-accent p-4">
            <p className="text-sm font-semibold text-accent-foreground">
              Hiring? Post a vacancy for 200 ETB
            </p>
            <p className="mt-1 text-xs text-accent-foreground/80">
              Requires an active premium subscription (500 ETB/month) from your dashboard.
            </p>
          </Card>
        ) : null}

        {(jobs.data ?? []).length === 0 ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            No open vacancies right now. Check back soon.
          </Card>
        ) : (
          (jobs.data ?? []).map((j) => {
            const h = j.hotels as { name?: string } | null;
            const applied = appliedIds.has(j.id);
            return (
              <Card key={j.id} className="shadow-card space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                    <Briefcase className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{j.title}</h2>
                    <p className="text-xs text-muted-foreground">{h?.name ?? "Hotel"}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{j.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    <MapPin className="mr-1 size-3" />
                    {j.location}
                  </Badge>
                  {j.salary ? (
                    <Badge variant="secondary">
                      <Banknote className="mr-1 size-3" />
                      {formatETB(j.salary)} / month
                    </Badge>
                  ) : null}
                </div>
                {role === "staff" ? (
                  <Button
                    className="w-full"
                    disabled={applied || applying === j.id}
                    onClick={() => {
                      setApplying(j.id);
                      apply.mutate(j.id);
                    }}
                  >
                    {applied ? "Applied ✓" : t("apply")}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Only staff accounts can apply to vacancies.
                  </p>
                )}
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
