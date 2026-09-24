import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  TrendingUp,
  Users,
  BedDouble,
  Crown,
  Star,
  Plus,
  AlertTriangle,
  Loader2,
  FileText,
  Phone,
} from "lucide-react";

import { PropertyForm, RoomsManager, ShowcaseManager } from "@/components/OwnerProperty";
import { TipQr } from "@/components/TipQr";
import { OwnerFeedbackInbox } from "@/components/OwnerFeedbackInbox";
import { OwnerPerformance } from "@/components/OwnerPerformance";
import { TeamChat } from "@/components/TeamChat";
import { TeamMeetings } from "@/components/TeamMeetings";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatETB, useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
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
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "Hotel Owner Dashboard — Moybirr" },
      {
        name: "description",
        content:
          "Track room revenue, tips and staff performance for your Ethiopian hotel, post vacancies and manage your Moybirr premium subscription.",
      },
      { property: "og:title", content: "Owner Dashboard — Moybirr" },
      {
        property: "og:description",
        content: "Revenue reports, staff ratings and hiring tools for hotel owners.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <OwnerPage />
      </AppShell>
    </RequireAuth>
  ),
});

function OwnerPage() {
  const { t } = useLang();
  const { user, role } = useAuth();
  const qc = useQueryClient();

  const hotel = useQuery({
    queryKey: ["my-hotel", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotels")
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const hotelId = hotel.data?.id ?? null;

  const plan = useQuery({
    queryKey: ["owner-plan", hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_plan_active", {
        _owner: user!.id,
      });
      if (error) throw error;
      return data as boolean;
    },
  });
  const premiumActive = plan.data === true;

  const bookings = useQuery({
    queryKey: ["owner-bookings", hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("hotel_id", hotelId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const staff = useQuery({
    queryKey: ["owner-staff", hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_staff_list", {
        _hotel_id: hotelId!,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStaffStatus = useMutation({
    mutationFn: async (vars: {
      id: string;
      status: "active" | "rejected" | "removed";
    }) => {
      const { error } = await supabase.rpc("set_staff_status", {
        _staff_profile_id: vars.id,
        _status: vars.status,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.status === "active"
          ? t("staff_approved")
          : vars.status === "rejected"
            ? t("request_rejected")
            : t("staff_removed"),
      );
      void qc.invalidateQueries({ queryKey: ["owner-staff", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingStaff = (staff.data ?? []).filter((s) => s.employment_status === "pending");
  const activeStaff = (staff.data ?? []).filter((s) => s.employment_status === "active");

  const hotelRatings = useQuery({
    queryKey: ["owner-hotel-ratings", hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_ratings")
        .select("id, stars, comment, created_at, profiles:guest_id(full_name)")
        .eq("hotel_id", hotelId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const myJobs = useQuery({
    queryKey: ["owner-jobs", hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, job_applications(id,status,staff_id)")
        .eq("hotel_id", hotelId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const performance = useQuery({
    queryKey: ["owner-summary", hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_performance_summary", {
        _hotel_id: hotelId!,
        _days: 30,
      });
      if (error) throw error;
      return data as {
        service_revenue: number;
        payments: number;
        room_revenue: number;
        bookings: number;
        service_rating: number;
        reviews: number;
        lifetime_rating: number;
        lifetime_reviews: number;
        staff_active: number;
        staff_pending: number;
        feedback_new: number;
      } | null;
    },
  });

  const subscribe = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("subscribe_premium");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("premium_success"));
      void qc.invalidateQueries({ queryKey: ["owner-plan"] });
      void qc.invalidateQueries({ queryKey: ["my-hotel"] });
      void qc.invalidateQueries({ queryKey: ["owner-summary"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role === null) {
    return (
      <>
        <AppHeader title={t("owner")} subtitle={t("loading")} />
        <div className="-mt-6 flex items-center justify-center px-4 py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (role !== "owner") {
    return (
      <>
        <AppHeader title={t("owner")} subtitle={t("owners_only")} />
        <div className="-mt-6 px-4">
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            {t("owner_only_message")}
          </Card>
        </div>
      </>
    );
  }

  const confirmed = (bookings.data ?? []).filter((b) => b.status === "confirmed");
  const roomRevenue = confirmed.reduce((s, b) => s + Number(b.total), 0);
  const occupancy = confirmed.filter((b) => new Date(b.check_out) >= new Date()).length;

  return (
    <>
      <AppHeader
        title={t("owner")}
        subtitle={hotel.data?.name ?? t("register_property_below")}
      />

      {hotel.data?.hotel_code ? (
        <div className="mx-4 -mt-4 mb-2 rounded-xl border border-border bg-card px-3 py-2 shadow-card">
          <p className="text-[11px] text-muted-foreground">{t("hotel_id_desc")}</p>
          <p className="text-sm font-bold tracking-wide">{hotel.data.hotel_code}</p>
        </div>
      ) : null}

      <div className="-mt-6 space-y-4 px-4 pb-6">
        <Card className="shadow-card flex items-center justify-between gap-3 p-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Crown className="size-4 text-primary" />
              {t("monthly_plan")}
            </p>
            <p className="text-xs text-muted-foreground">
              {plan.isLoading
                ? t("checking")
                : premiumActive
                  ? t("owner_dashboard.premium_active")
                  : t("owner_dashboard.premium_inactive")}
            </p>
          </div>
          {!premiumActive && !plan.isLoading ? (
            <Button size="sm" disabled={subscribe.isPending} onClick={() => subscribe.mutate()}>
              {subscribe.isPending ? t("paying") : t("owner_dashboard.pay_subscription")}
            </Button>
          ) : premiumActive ? (
            <Badge variant="secondary">{t("status.active")}</Badge>
          ) : null}
        </Card>

        {!premiumActive && !plan.isLoading ? (
          <Card className="shadow-card flex items-start gap-2 border-destructive/40 p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-xs text-muted-foreground">
              {t("owner_dashboard.paused_warning")}
            </p>
          </Card>
        ) : null}

        {hotelId ? (
          <div className="grid grid-cols-2 gap-3">
            <Stat
              icon={<TrendingUp className="size-4 text-primary" />}
              label={t("owner_dashboard.room_revenue")}
              value={formatETB(roomRevenue)}
            />
            <Stat
              icon={<BedDouble className="size-4 text-primary" />}
              label={t("owner_dashboard.active_stays")}
              value={String(occupancy)}
            />
            <Stat
              icon={<Users className="size-4 text-primary" />}
              label={t("owner_dashboard.staff_members")}
              value={String(activeStaff.length)}
            />
          </div>
        ) : null}

        <Tabs defaultValue={hotelId ? "bookings" : "property"}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="property">{t("owner_dashboard.tab_property")}</TabsTrigger>
            <TabsTrigger value="rooms" disabled={!hotelId}>{t("owner_dashboard.tab_rooms")}</TabsTrigger>
            <TabsTrigger value="showcase" disabled={!hotelId}>{t("owner_dashboard.tab_showcase")}</TabsTrigger>
            <TabsTrigger value="bookings" disabled={!hotelId}>{t("owner_dashboard.tab_bookings")}</TabsTrigger>
            <TabsTrigger value="staff" disabled={!hotelId}>{t("owner_dashboard.tab_staff")}</TabsTrigger>
            <TabsTrigger value="team" disabled={!hotelId}>{t("owner_dashboard.tab_team")}</TabsTrigger>
            <TabsTrigger value="meetings" disabled={!hotelId}>{t("owner_dashboard.tab_meetings")}</TabsTrigger>
            <TabsTrigger value="feedback" disabled={!hotelId}>{t("owner_dashboard.tab_feedback")}</TabsTrigger>
            <TabsTrigger value="performance" disabled={!hotelId}>{t("owner_dashboard.tab_performance")}</TabsTrigger>
            <TabsTrigger value="jobs" disabled={!hotelId}>{t("owner_dashboard.tab_jobs")}</TabsTrigger>
          </TabsList>

          <TabsContent value="property" className="mt-3 space-y-3">
            <PropertyForm hotel={hotel.data ?? null} />
            {hotelId && hotel.data?.hotel_code ? (
              <TipQr
                title={t("table_qr_title")}
                description={t("table_qr_desc")}
                hotelCode={hotel.data.hotel_code}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="rooms" className="mt-3">
            {hotelId ? <RoomsManager hotelId={hotelId} /> : null}
          </TabsContent>

          <TabsContent value="showcase" className="mt-3">
            {hotelId ? (
              <ShowcaseManager hotelId={hotelId} premiumActive={premiumActive} />
            ) : null}
          </TabsContent>

          <TabsContent value="bookings" className="mt-3 space-y-3">
            {bookings.isLoading ? (
              <Empty text={t("loading_bookings")} />
            ) : (bookings.data ?? []).length === 0 ? (
              <Empty text={t("no_bookings")} />
            ) : (
              (bookings.data ?? []).map((b) => (
                <Card key={b.id} className="shadow-card flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-semibold">{b.room_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.check_in} → {b.check_out}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatETB(b.total)}</p>
                    <Badge
                      variant={b.status === "cancelled" ? "destructive" : "secondary"}
                      className="mt-1"
                    >
                      {t(`status.${b.status}`) || b.status}
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="staff" className="mt-3 space-y-3">
            <Card className="shadow-card p-4">
              <p className="text-xs text-muted-foreground">{t("hotel_service_rating")}</p>
              <p className="mt-1 text-2xl font-bold">
                {Number(hotel.data?.rating ?? 0) > 0
                  ? Number(hotel.data?.rating).toFixed(1)
                  : "—"}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / 5 · {hotel.data?.rating_count ?? 0} {t("reviews")}
                </span>
              </p>
            </Card>

            {pendingStaff.length > 0 ? (
              <>
                <p className="text-sm font-semibold">
                  {t("waiting_approval")} ({pendingStaff.length})
                </p>
                <p className="text-xs text-muted-foreground">{t("pending_staff_hint")}</p>
                {pendingStaff.map((s) => (
                  <Card key={s.staff_profile_id} className="shadow-card border-primary/40 p-4">
                    <p className="text-sm font-semibold">{s.full_name || t("staff_member")}</p>
                    <p className="text-xs capitalize text-muted-foreground">{s.position}</p>
                    <p className="text-xs text-muted-foreground">
                      {[s.phone, s.moybirr_id].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {[s.city, s.subcity].filter(Boolean).join(" · ") || t("location_not_set")}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        disabled={setStaffStatus.isPending}
                        onClick={() =>
                          setStaffStatus.mutate({ id: s.staff_profile_id!, status: "active" })
                        }
                      >
                        {t("approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={setStaffStatus.isPending}
                        onClick={() =>
                          setStaffStatus.mutate({ id: s.staff_profile_id!, status: "rejected" })
                        }
                      >
                        {t("reject")}
                      </Button>
                    </div>
                  </Card>
                ))}
              </>
            ) : null}

            <p className="pt-2 text-sm font-semibold">{t("staff_performance")}</p>
            {activeStaff.length === 0 ? (
              <Empty text={t("no_staff_hint")} />
            ) : (
              activeStaff.map((s) => (
                <Card key={s.staff_profile_id} className="shadow-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{s.full_name || t("staff_member")}</p>
                      <p className="text-xs capitalize text-muted-foreground">{s.position}</p>
                      {s.phone ? (
                        <p className="text-xs text-muted-foreground">{s.phone}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {[s.city, s.subcity].filter(Boolean).join(" · ") || t("location_not_set")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="flex items-center justify-end gap-1 text-sm font-bold">
                        <Star className="size-4 fill-primary text-primary" />
                        {Number(s.rating).toFixed(1)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.rating_count} {t("guest_ratings")}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-7 px-2 text-[11px] text-destructive"
                        disabled={setStaffStatus.isPending}
                        onClick={() =>
                          setStaffStatus.mutate({ id: s.staff_profile_id!, status: "removed" })
                        }
                      >
                        {t("remove")}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}

            <p className="pt-2 text-sm font-semibold">{t("recent_reviews")}</p>
            {hotelRatings.isLoading ? (
              <Empty text={t("loading_reviews")} />
            ) : (hotelRatings.data ?? []).length === 0 ? (
              <Empty text={t("no_reviews")} />
            ) : (
              (hotelRatings.data ?? []).map((r) => {
                const g = r.profiles as { full_name?: string } | null;
                return (
                  <Card key={r.id} className="shadow-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{g?.full_name || t("guest")}</p>
                      <p className="flex items-center gap-1 text-sm font-bold">
                        <Star className="size-4 fill-primary text-primary" />
                        {r.stars}
                      </p>
                    </div>
                    {r.comment ? (
                      <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="team" className="mt-3">
            {hotelId ? <TeamChat hotelId={hotelId} /> : null}
          </TabsContent>

          <TabsContent value="meetings" className="mt-3">
            {hotelId ? <TeamMeetings hotelId={hotelId} canSchedule /> : null}
          </TabsContent>

          <TabsContent value="feedback" className="mt-3">
            {hotelId ? <OwnerFeedbackInbox hotelId={hotelId} /> : null}
          </TabsContent>

          <TabsContent value="performance" className="mt-3">
            {hotelId ? <OwnerPerformance hotelId={hotelId} /> : null}
          </TabsContent>

          <TabsContent value="jobs" className="mt-3 space-y-3">
            {hotelId ? (
              <PostJobDialog hotelId={hotelId} premiumActive={premiumActive} />
            ) : null}
            {(myJobs.data ?? []).length === 0 ? (
              <Empty text={t("no_vacancies")} />
            ) : (
              (myJobs.data ?? []).map((j) => {
                const apps = (j.job_applications as { id: string }[] | null) ?? [];
                return (
                  <Card key={j.id} className="shadow-card space-y-1 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{j.title}</p>
                      <Badge variant="secondary">{t(`status.${j.status}`) || j.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {j.location}
                      {j.salary ? ` · ${formatETB(j.salary)} / ${t("month")}` : ""}
                    </p>

                    <ApplicantDialog jobId={j.id} jobTitle={j.title} />
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="shadow-card p-4">
      <div className="flex size-9 items-center justify-center rounded-xl bg-accent">{icon}</div>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
      {text}
    </Card>
  );
}

function ApplicantDialog({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  const applicants = useQuery({
    queryKey: ["job-applicants", jobId],
    enabled: !!jobId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owner_job_applicants")
        .select("*")
        .eq("job_id", jobId);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full mt-2">
          {t("staff_actions.view_applicants")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("jobs.applicants_title", { job: jobTitle })}</DialogTitle>
          <DialogDescription>{t("jobs.applicants_desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {applicants.isLoading ? (
            <p className="text-center text-sm text-muted-foreground">{t("loading")}</p>
          ) : (applicants.data ?? []).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">{t("jobs.no_applicants")}</p>
          ) : (
            (applicants.data ?? []).map((app: any) => (
              <Card key={app.id} className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm">{app.full_name || t("applicant")}</p>
                    <p className="text-xs text-muted-foreground capitalize">{app.position}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-accent px-2 py-1 rounded-md">
                    <Star className="size-3 fill-primary text-primary" />
                    <span className="text-xs font-bold">
                      {Number(app.rating).toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="size-3" />
                  {app.phone || t("no_phone_provided")}
                </div>

                {app.document_url ? (
                  <a
                    href={app.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-xs text-primary underline mt-2"
                  >
                    <FileText className="size-3" />
                    {t("jobs.view_resume")}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground italic mt-2">
                    {t("jobs.no_document")}
                  </p>
                )}
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PostJobDialog({
  hotelId,
  premiumActive,
}: {
  hotelId: string;
  premiumActive: boolean;
}) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");

  const post = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("post_job", {
        _hotel_id: hotelId,
        _title: title,
        _description: description,
        _location: location,
        _salary: salary ? Number(salary) : 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("vacancy_posted_success"));
      void qc.invalidateQueries({ queryKey: ["owner-jobs"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setLocation("");
      setSalary("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" disabled={!premiumActive}>
          <Plus className="mr-2 size-4" />
          {premiumActive ? t("post_vacancy_btn") : t("subscribe_to_post")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("post_vacancy_title")}</DialogTitle>
          <DialogDescription>{t("post_vacancy_desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="jt">{t("job_title")}</Label>
            <Input
              id="jt"
              placeholder={t("job_title_placeholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jd">{t("job_description")}</Label>
            <Textarea
              id="jd"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="jl">{t("job_location")}</Label>
              <Input
                id="jl"
                placeholder="Addis Ababa"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="js">{t("job_salary")}</Label>
              <Input
                id="js"
                type="number"
                inputMode="numeric"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
            </div>
          </div>
          <Button
            className="w-full"
            disabled={!title || !location || post.isPending}
            onClick={() => post.mutate()}
          >
            {t("pay_publish_btn")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}