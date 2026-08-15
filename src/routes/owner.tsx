import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { TrendingUp, Users, BedDouble, Crown, Star, Plus, AlertTriangle } from "lucide-react";
import { PropertyForm, RoomsManager, ShowcaseManager } from "@/components/OwnerProperty";
import { TipQr } from "@/components/TipQr";

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
    queryFn: async () => {
      const { data } = await supabase
        .from("hotels")
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const hotelId = hotel.data?.id;

  const bookings = useQuery({
    queryKey: ["owner-bookings", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("hotel_id", hotelId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hotelId,
  });

  const staff = useQuery({
    queryKey: ["owner-staff", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("id,position,rating,rating_count, profiles:user_id(full_name)")
        .eq("hotel_id", hotelId!)
        .order("rating", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hotelId,
  });

  const myJobs = useQuery({
    queryKey: ["owner-jobs", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, job_applications(id,status,staff_id)")
        .eq("hotel_id", hotelId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hotelId,
  });

  const tips = useQuery({
    queryKey: ["owner-tips", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount")
        .eq("type", "tip");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!hotelId,
  });

  const premium = useQuery({
    queryKey: ["owner-premium", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("end_date")
        .eq("owner_id", user!.id)
        .order("end_date", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!user,
  });


  const subscribe = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("subscribe_premium");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Premium active for 30 days");
      void qc.invalidateQueries({ queryKey: ["owner-premium"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (role !== "owner") {
    return (
      <>
        <AppHeader title={t("owner")} subtitle="Hotel owners only" />
        <div className="-mt-6 px-4">
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            This dashboard is available to hotel owner accounts. Register a new account with the
            Owner role to manage a property.
          </Card>
        </div>
      </>
    );
  }

  const confirmed = (bookings.data ?? []).filter((b) => b.status !== "cancelled");
  const roomRevenue = confirmed.reduce((s, b) => s + Number(b.total), 0);
  const tipTotal = (tips.data ?? []).reduce((s, x) => s + Number(x.amount), 0);
  const occupancy = confirmed.filter((b) => new Date(b.check_out) >= new Date()).length;
  const premiumUntil = premium.data ? new Date(premium.data.end_date) : null;
  const premiumActive = !!premiumUntil && premiumUntil > new Date();

  return (
    <>
      <AppHeader title={t("owner")} subtitle={hotel.data?.name ?? "Register your property below"} />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        <Card className="shadow-card flex items-center justify-between gap-3 p-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Crown className="size-4 text-primary" />
              Monthly listing plan
            </p>
            <p className="text-xs text-muted-foreground">
              {premiumActive
                ? `Active until ${premiumUntil!.toLocaleDateString()}`
                : "500 ETB / month — required to stay listed, post jobs and see analytics"}
            </p>
          </div>
          {!premiumActive ? (
            <Button size="sm" disabled={subscribe.isPending} onClick={() => subscribe.mutate()}>
              Pay 500 ETB
            </Button>
          ) : (
            <Badge variant="secondary">Active</Badge>
          )}
        </Card>

        {!premiumActive ? (
          <Card className="shadow-card flex items-start gap-2 border-destructive/40 p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-xs text-muted-foreground">
              Your listing is <span className="font-semibold text-destructive">paused</span>. Guests
              cannot see your hotel, rooms or showcase and cannot book until this month&apos;s 500
              ETB is paid. Everything is restored the moment you pay.
            </p>
          </Card>
        ) : null}

        {hotelId ? (
          <div className="grid grid-cols-2 gap-3">
            <Stat
              icon={<TrendingUp className="size-4 text-primary" />}
              label="Room revenue"
              value={formatETB(roomRevenue)}
            />
            <Stat
              icon={<Star className="size-4 text-primary" />}
              label="Staff tips"
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
              value={String((staff.data ?? []).length)}
            />
          </div>
        ) : null}

        <Tabs defaultValue={hotelId ? "bookings" : "property"}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="property">Property</TabsTrigger>
            <TabsTrigger value="rooms" disabled={!hotelId}>
              Rooms
            </TabsTrigger>
            <TabsTrigger value="showcase" disabled={!hotelId}>
              Showcase
            </TabsTrigger>
            <TabsTrigger value="bookings" disabled={!hotelId}>
              Bookings
            </TabsTrigger>
            <TabsTrigger value="staff" disabled={!hotelId}>
              Staff
            </TabsTrigger>
            <TabsTrigger value="jobs" disabled={!hotelId}>
              Jobs
            </TabsTrigger>
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
            {hotelId ? <ShowcaseManager hotelId={hotelId} /> : null}
          </TabsContent>

          <TabsContent value="bookings" className="mt-3 space-y-3">
            {(bookings.data ?? []).length === 0 ? (
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
            {(staff.data ?? []).length === 0 ? (
              <Empty text="No staff registered yet." />
            ) : (
              (staff.data ?? []).map((s) => {
                const p = s.profiles as { full_name?: string } | null;
                return (
                  <Card key={s.id} className="shadow-card flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-semibold">{p?.full_name || "Staff member"}</p>
                      <p className="text-xs capitalize text-muted-foreground">{s.position}</p>
                    </div>
                    <div className="text-right">
                      <p className="flex items-center justify-end gap-1 text-sm font-bold">
                        <Star className="size-4 fill-primary text-primary" />
                        {Number(s.rating).toFixed(1)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.rating_count} guest ratings
                      </p>
                    </div>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="jobs" className="mt-3 space-y-3">
            {hotelId ? (
              <PostJobDialog hotelId={hotelId} premiumActive={!!premiumActive} />
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


function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
    <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">{text}</Card>
  );
}

function PostJobDialog({ hotelId, premiumActive }: { hotelId: string; premiumActive: boolean }) {
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
            200 ETB is deducted from your wallet. The vacancy is visible to all staff accounts.
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
