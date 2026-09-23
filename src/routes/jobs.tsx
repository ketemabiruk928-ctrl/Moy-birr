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
        .select("job_id,status")
        .eq("staff_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Function to handle document upload
  const handleUpload = async (jobId: string, file: File) => {
    if (!user) return;
    setUploading(jobId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${jobId}_${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('staff_documents')
        .upload(fileName, file);

      if (error) throw error;

      // Get the public URL (or signed URL) to save in the DB
      const { data: urlData } = supabase.storage
        .from('staff_documents')
        .getPublicUrl(data.path);

      setDocumentUrls(prev => ({ ...prev, [jobId]: urlData.publicUrl }));
      toast.success("Document attached");
    } catch (e: any) {
      toast.error("Failed to upload document: " + e.message);
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
          message: "Applied via Moybirr",
          document_url: documentUrls[jobId] || null // Save the document link
        });
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
            const docUrl = documentUrls[j.id];
            
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
                  <div className="space-y-3 pt-2 border-t border-border">
                    {/* Document Upload Section */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Attach Resume/Certificate (Optional)</Label>
                      {docUrl ? (
                        <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs text-primary">
                          <FileText className="size-4" />
                          <span className="truncate">Document attached</span>
                        </div>
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
                          <Button variant="outline" className="w-full pointer-events-none">
                            <Upload className="mr-2 size-4" />
                            {uploading === j.id ? "Uploading..." : "Choose File"}
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
                      {applied ? "Applied ✓" : uploading === j.id ? "Uploading..." : t("apply")}
                    </Button>
                  </div>
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
