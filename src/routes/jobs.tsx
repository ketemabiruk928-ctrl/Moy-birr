import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Briefcase, MapPin, Banknote, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatETB, useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  // Track document URLs per job ID
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

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
        .select("job_id,status,document_url")
        .eq("staff_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const handleUpload = async (jobId: string, file: File) => {
    if (!user) return;
    setUploading(jobId);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${jobId}_${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("staff_documents")
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("staff_documents")
        .getPublicUrl(data.path);

      setDocumentUrls((prev) => ({ ...prev, [jobId]: urlData.publicUrl }));
      toast.success(t("jobs_page.document_attached"));
    } catch (e: any) {
      toast.error(t("jobs_page.upload_failed") + ": " + e.message);
    } finally {
      setUploading(null);
    }
  };

  const apply = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("job_applications")
        .insert({
          job_id: jobId,
          staff_id: user!.id,
          message: t("jobs_page.applied_via_moybirr"),
          document_url: documentUrls[jobId] || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("jobs_page.apply_success"));
      void qc.invalidateQueries({ queryKey: ["my-applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setApplying(null),
  });

  const appliedIds = new Set((applications.data ?? []).map((a) => a.job_id));

  return (
    <>
      <AppHeader title={t("jobs")} subtitle={t("jobs_page.subtitle")} />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        {role === "owner" ? (
          <Card className="shadow-card border-primary/30 bg-accent p-4">
            <p className="text-sm font-semibold text-accent-foreground">
              {t("jobs_page.hiring_banner")}
            </p>
            <p className="mt-1 text-xs text-accent-foreground/80">
              {t("jobs_page.hiring_banner_desc")}
            </p>
          </Card>
        ) : null}

        {(jobs.data ?? []).length === 0 ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            {t("jobs_page.no_jobs")}
          </Card>
        ) : (
          (jobs.data ?? []).map((j) => {
            const h = j.hotels as { name?: string } | null;
            const applied = appliedIds.has(j.id);
            const docUrl = documentUrls[j.id];

            return (
              <Card key={j.id} className="shadow-card space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                    <Briefcase className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{j.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {h?.name ?? t("jobs_page.hotel")}
                    </p>
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
                      {formatETB(j.salary)} / {t("month")}
                    </Badge>
                  ) : null}
                </div>

                {role === "staff" ? (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("jobs_page.attach_resume")}</Label>
                      {docUrl ? (
                        <a
                          href={docUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 rounded-md bg-accent p-2 text-xs font-medium text-primary hover:bg-accent/80"
                        >
                          <FileText className="size-4 shrink-0" />
                          <span className="truncate">
                            {t("jobs_page.document_attached")}
                          </span>
                          <span className="ml-auto shrink-0 text-[10px] underline">
                            {t("jobs_page.view_resume")}
                          </span>
                        </a>
                      ) : (
                        <div className="relative">
                          <Input
                            type="file"
                            accept=".pdf,.doc,.docx,image/*"
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(j.id, file);
                            }}
                            disabled={uploading === j.id}
                          />
                          <Button
                            variant="outline"
                            className="w-full pointer-events-none"
                          >
                            <Upload className="mr-2 size-4" />
                            {uploading === j.id
                              ? t("jobs_page.uploading")
                              : t("jobs_page.choose_file")}
                          </Button>
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      disabled={applied || applying === j.id || uploading === j.id}
                      onClick={() => {
                        setApplying(j.id);
                        apply.mutate(j.id);
                      }}
                    >
                      {applied
                        ? t("staff_actions.applied") + " ✓"
                        : uploading === j.id
                          ? t("jobs_page.uploading")
                          : t("staff_actions.apply")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("jobs_page.only_staff_apply")}
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