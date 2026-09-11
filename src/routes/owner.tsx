import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  TrendingUp, Users, BedDouble, Crown, Star, Plus, AlertTriangle, Loader2,
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
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
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

  // ─── The owner's hotel ───────────────────────────────────────────────
  // Uses .maybeSingle() but now surfaces the error, so a broken query no
  // longer looks identical to "you haven't registered a hotel yet".
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

  // ─── Plan gate, read from the DB ─────────────────────────────────────
  // owner_plan_active() is the single source of truth (it's what RLS uses).
  // Previously the UI computed this a second time from subscriptions.end_date
  // and could disagree with what the DB enforced.
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

  // ─── Bookings ────────────────────────────────────────────────────────
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

  // ─── Staff (incl. pending), via RPC that also enforces ownership ─────
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
          ? "Staff member approved"
          : vars.status === "rejected"
            ? "Request rejected"
            : "Staff member removed",
      );
      void qc.invalidateQueries({ queryKey: ["owner-staff", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingStaff = (staff.data ?? []).filter((s) => s.employment_status === "pending");
  const activeStaff = (staff.data ?? []).filter((s) => s.employment_status === "active");

  // ─── Hotel reviews ───────────────────────────────────────────────────
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

  // ─── Jobs ────────────────────────────────────────────────────────────
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

  // ─── Performance summary (replaces the broken "all tips" query) ──────
  // The old code did: supabase.from("transactions").select("amount")
  //   .eq("type","tip")
  // with NO hotel filter — so it summed every tip on the platform.
  // owner_performance_summary() computes this correctly per hotel.
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
        staff_tips_total: number;
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

  // ─── Subscribe ───────────────────────────────────────────────────────
  const subscribe = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("subscribe_premium");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Premium active for 30 days");
      // Invalidate the plan query too — owner_plan_active() reads the
      // subscriptions table and would otherwise look stale until refresh.
      void qc.invalidateQueries({ queryKey: ["owner-plan"] });
      void qc.invalidateQueries({ queryKey: ["my-hotel"] });
      void qc.invalidateQueries({ queryKey: ["owner-summary"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Wait for role to resolve, then gate ────────────────────────────
  // The old check was `role !== "owner"` inside the render. If useAuth
  // hasn't finished resolving on first paint, role is null and a real
  // owner sees the "owners only" card. This handles the transient state.
  if (role === null) {
    return (
      <>
        <AppHeader title="Owner dashboard" subtitle="Loading…" />
        <div className="-mt-6 flex items-center justify-center px-4 py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (role !== "owner") {
    return (
      <>
        <AppHeader title={t("owner")} subtitle="Hotel owners only" />
        <div className="-mt-6 px-4">
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            This dashboard is available to hotel owner accounts. Your account
            role is <span className="font-semibold">{role}</span>. Register a
            new account with the Owner role, or contact support to change it.
          </Card>
        </div>
      </>
    );
  }

  // ─── Derive header stats from the summary RPC, not from raw sums ────
  const confirmed = (bookings.data ?? []).filter((b) => b.status === "confirmed");
  const roomRevenue = confirmed.reduce((s, b) => s + Number(b.total), 0);
  const occupancy = confirmed.filter((b) => new Date(b.check_out) >= new Date()).length;
  const tipTotal = Number(performance.data?.staff_tips_total ?? 0);

  return (
    <>
      <AppHeader
        title={t("owner")}
        subtitle={hotel.data?.name ?? "Register your property below"}
      />

      {hotel.data?.hotel_code ? (
        <div className="mx-4 -mt-4 mb-2 rounded-xl border border-border bg-card px-3 py-2 shadow-card">
          <p className="text-[11px] text-muted-foreground">
            Hotel ID (give this to your staff)
          </p>
          <p className="text-sm font-bold tracking-wide">{hotel.data.hotel_code}</p>
        </div>
      ) : null}

      <div className="-mt-6 space-y-4 px-4 pb-6">
        {/* ── Plan card ── */}
        <Card className="shadow-card flex items-center justify-between gap-3 p-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Crown className="size-4 text-primary" />
              Monthly listing plan
            </p>
            <p className="text-xs text-muted-foreground">
              {plan.isLoading
                ? "Checking…"
                : premiumActive
                  ? "Active — your listing is visible to guests"
                  : "500 ETB / month — required to stay listed, post jobs and see analytics"}
            </p>
          </div>
          {!premiumActive && !plan.isLoading ? (
            <Button size="sm" disabled={subscribe.isPending} onClick={() => subscribe.mutate()}>
              {subscribe.isPending ? "Paying…" : "Pay 500 ETB"}
            </Button>
          ) : premiumActive ? (
            <Badge variant="secondary">Active</Badge>
          ) : null}
        </Card>

        {!premiumActive && !plan.isLoading ? (
          <Card className="shadow-card flex items-start gap-2 border-destructive/40 p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-xs text-muted-foreground">
              Your listing is <span className="font-semibold text-destructive">paused</span>.
              Guests cannot see your hotel, rooms or showcase and cannot book until
              this month&apos;s 500 ETB is paid. Everything is restored the moment you pay.
            </p>
          </Card>
        ) : null}

        {/* ── Stat tiles ── */}
        {hotelId ? (
          <div className="grid grid-cols-2 gap-3">
            <Stat
              icon={<TrendingUp className="size-4 text-primary" />}
              label="Room revenue"
              value={formatETB(roomRevenue)}
            />
            <Stat
              icon={<Star className="size-4 text-primary" />}
              label="Staff tips (30d)"
              value={formatETB(tipTotal)}
            />
            <Stat
              icon={<BedDouble className="size-4 text-primary" />}
              label="Active stays"
              value={String(occupancy)}
            />
            <Stat
              icon={<Users className="size-4 text-primary" />}
              label="Staff members"
              value={String(activeStaff.length)}
            />
          </div>
        ) : null}

        {/* ── Tabs ── */}
        <Tabs defaultValue={hotelId ? "bookings" : "property"}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="property">Property</TabsTrigger>
            <TabsTrigger value="rooms" disabled={!hotelId}>Rooms</TabsTrigger>
            <TabsTrigger value="showcase" disabled={!hotelId}>Showcase</TabsTrigger>
            <TabsTrigger value="bookings" disabled={!hotelId}>Bookings</TabsTrigger>
            <TabsTrigger value="staff" disabled={!hotelId}>Staff</TabsTrigger>
            <TabsTrigger value="team" disabled={!hotelId}>Team chat</TabsTrigger>
            <TabsTrigger value="meetings" disabled={!hotelId}>Meetings</TabsTrigger>
            <TabsTrigger value="feedback" disabled={!hotelId}>Guest messages</TabsTrigger>
            <TabsTrigger value="performance" disabled={!hotelId}>Performance</TabsTrigger>
            <TabsTrigger value="jobs" disabled={!hotelId}>Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="property" className="mt-3 space-y-3">
            <PropertyForm hotel={hotel.data ?? null} />
            {hotelId ? (
              <TipQr
                title="Table QR code"
                description="Print this for your tables and reception. Guests scan it to pay the bill and tip your staff."
                hotelId={hotelId}
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
              <Empty text="Loading bookings…" />
            ) : (bookings.data ?? []).length === 0 ? (
              <Empty text="No bookings yet." />
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
                      {b.status}
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="staff" className="mt-3 space-y-3">
            <Card className="shadow-card p-4">
              <p className="text-xs text-muted-foreground">Hotel service rating</p>
              <p className="mt-1 text-2xl font-bold">
                {Number(hotel.data?.rating ?? 0) > 0
                  ? Number(hotel.data?.rating).toFixed(1)
                  : "—"}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / 5 · {hotel.data?.rating_count ?? 0} reviews
                </span>
              </p>
            </Card>

            {pendingStaff.length > 0 ? (
              <>
                <p className="text-sm font-semibold">
                  Waiting for your approval ({pendingStaff.length})
                </p>
                <p className="text-xs text-muted-foreground">
                  These people entered your Hotel ID. They cannot receive tips at
                  your property until you approve them.
                </p>
                {pendingStaff.map((s) => (
                  <Card key={s.staff_profile_id} className="shadow-card border-primary/40 p-4">
                    <p className="text-sm font-semibold">{s.full_name || "Staff member"}</p>
                    <p className="text-xs capitalize text-muted-foreground">{s.position}</p>
                    <p className="text-xs text-muted-foreground">
                      {[s.phone, s.moybirr_id].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {[s.city, s.subcity].filter(Boolean).join(" · ") || "Location not set"}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        disabled={setStaffStatus.isPending}
                        onClick={() =>
                          setStaffStatus.mutate({ id: s.staff_profile_id!, status: "active" })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={setStaffStatus.isPending}
                        onClick={() =>
                          setStaffStatus.mutate({ id: s.staff_profile_id!, status: "rejected" })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  </Card>
                ))}
              </>
            ) : null}

            <p className="pt-2 text-sm font-semibold">Staff performance</p>
            {activeStaff.length === 0 ? (
              <Empty text="No approved staff yet. Share your Hotel ID so staff can request to join." />
            ) : (
              activeStaff.map((s) => (
                <Card key={s.staff_profile_id} className="shadow-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{s.full_name || "Staff member"}</p>
                      <p className="text-xs capitalize text-muted-foreground">{s.position}</p>
                      {s.phone ? (
                        <p className="text-xs text-muted-foreground">{s.phone}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {[s.city, s.subcity].filter(Boolean).join(" · ") || "Location not set"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="flex items-center justify-end gap-1 text-sm font-bold">
                        <Star className="size-4 fill-primary text-primary" />
                        {Number(s.rating).toFixed(1)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.rating_count} guest ratings
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
                        Remove
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}

            <p className="pt-2 text-sm font-semibold">Recent hotel reviews</p>
            {hotelRatings.isLoading ? (
              <Empty text="Loading reviews…" />
            ) : (hotelRatings.data ?? []).length === 0 ? (
              <Empty text="No hotel service reviews yet." />
            ) : (
              (hotelRatings.data ?? []).map((r) => {
                const g = r.profiles as { full_name?: string } | null;
                return (
                  <Card key={r.id} className="shadow-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{g?.full_name || "Guest"}</p>
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
              <Empty text="No vacancies posted yet." />
            ) : (
              (myJobs.data ?? []).map((j) => {
                const apps = (j.job_applications as { id: string }[] | null) ?? [];
                return (
                  <Card key={j.id} className="shadow-card space-y-1 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{j.title}</p>
                      <Badge variant="secondary">{j.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {j.location}
                      {j.salary ? ` · ${formatETB(j.salary)} / month` : ""}
                    </p>
                    <p className="text-xs font-medium text-primary">
                      {apps.length} application{apps.length === 1 ? "" : "s"}
                    </p>
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

function PostJobDialog({
  hotelId,
  premiumActive,
}: {
  hotelId: string;
  premiumActive: boolean;
}) {
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
      toast.success("Vacancy posted — 200 ETB charged to your wallet");
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
          {premiumActive ? "Post a vacancy (200 ETB)" : "Subscribe to premium to post jobs"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post a vacancy</DialogTitle>
          <DialogDescription>
            200 ETB is deducted from your wallet. The vacancy is visible to all
            staff accounts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="jt">Job title</Label>
            <Input
              id="jt"
              placeholder="Senior waiter"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jd">Description</Label>
            <Textarea
              id="jd"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="jl">Location</Label>
              <Input
                id="jl"
                placeholder="Addis Ababa"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="js">Salary (ETB)</Label>
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
            Pay 200 ETB & publish
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
