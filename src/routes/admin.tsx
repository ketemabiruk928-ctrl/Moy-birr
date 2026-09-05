import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const ADMIN_PHONE_EMAIL = "0963154217@moybirr.app";

function AdminPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const qc = useQueryClient();
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState<"all" | "guest" | "staff" | "owner">("all");
  const [search, setSearch] = useState("");

  const isAllowedAdmin =
    !!user?.email && user.email.toLowerCase() === ADMIN_PHONE_EMAIL.toLowerCase();

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    enabled: isAllowedAdmin,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_platform_stats");
      if (error) throw error;
      return data as {
        guests: number;
        staff: number;
        owners: number;
        blocked_users: number;
        hotels: number;
        total_transaction_volume: number;
        platform_revenue: number;
        pending_deposits: number;
        pending_payouts: number;
      };
    },
  });

  const membersQuery = useQuery({
    queryKey: ["admin-members"],
    enabled: isAllowedAdmin,
    retry: false,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, moybirr_id, is_blocked, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rErr) throw rErr;

      const roleMap = new Map<string, string>();
      for (const r of roles ?? []) {
        roleMap.set(r.user_id, r.role);
      }

      return (profiles ?? []).map((p) => ({
        ...p,
        role: roleMap.get(p.id) ?? "guest",
      }));
    },
  });

  const movementsQuery = useQuery({
    queryKey: ["admin-movements"],
    enabled: isAllowedAdmin,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, created_at, type, amount, note")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_block_user", {
        _target_moybirr_id: targetId,
        _reason: reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${targetId} blocked`);
      setTargetId("");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin-stats"] });
      void qc.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unblockMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_unblock_user", {
        _target_moybirr_id: targetId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${targetId} unblocked`);
      setTargetId("");
      void qc.invalidateQueries({ queryKey: ["admin-stats"] });
      void qc.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (membersQuery.data ?? []).filter((m) => {
      if (filter !== "all" && m.role !== filter) return false;
      if (!q) return true;
      return (
        (m.full_name || "").toLowerCase().includes(q) ||
        (m.phone || "").toLowerCase().includes(q) ||
        (m.moybirr_id || "").toLowerCase().includes(q)
      );
    });
  }, [membersQuery.data, filter, search]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-primary px-6 pt-14 pb-12 text-primary-foreground">
          <div className="mx-auto w-full max-w-lg">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-foreground/15">
              <ShieldCheck className="size-7" />
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight">Moybirr Admin</h1>
            <p className="mt-2 text-sm opacity-90">Private control panel</p>
          </div>
        </div>
        <div className="mx-auto -mt-6 w-full max-w-lg px-4">
          <Card className="shadow-card space-y-4 p-5 text-center">
            <p className="text-sm text-muted-foreground">
              Log in with admin phone <b>0963154217</b> first, then open this page again.
            </p>
            <Button asChild className="w-full">
              <Link to="/auth">Go to login</Link>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!isAllowedAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-primary px-6 pt-14 pb-12 text-primary-foreground">
          <div className="mx-auto w-full max-w-lg">
            <h1 className="text-3xl font-bold">Access denied</h1>
            <p className="mt-2 text-sm opacity-90">Only authorized admin phone can enter</p>
          </div>
        </div>
        <div className="mx-auto -mt-6 w-full max-w-lg px-4">
          <Card className="shadow-card space-y-3 p-5 text-center">
            <p className="text-xs text-muted-foreground">Current: {user.email}</p>
            <Button variant="outline" className="w-full" onClick={() => void signOut()}>
              Log out
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const stats = statsQuery.data;

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Same style as Moybirr login header */}
      <div className="bg-gradient-primary px-6 pt-14 pb-12 text-primary-foreground">
        <div className="mx-auto flex w-full max-w-lg items-start justify-between gap-3">
          <div>
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-foreground/15">
              <Wallet className="size-6" />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Moybirr Admin</h1>
            <p className="mt-1 text-sm opacity-90">Members, movements & control</p>
            <p className="mt-1 text-xs opacity-75">{user.email}</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
            onClick={() => void signOut()}
          >
            Log out
          </Button>
        </div>
      </div>

      <div className="mx-auto -mt-6 w-full max-w-lg space-y-4 px-4">
        {/* Stats */}
        <Card className="shadow-card grid grid-cols-2 gap-3 p-4">
          <Stat label="Guests" value={stats?.guests} />
          <Stat label="Staff" value={stats?.staff} />
          <Stat label="Owners" value={stats?.owners} />
          <Stat label="Blocked" value={stats?.blocked_users} />
          <Stat label="Hotels" value={stats?.hotels} />
          <Stat label="Volume (ETB)" value={stats?.total_transaction_volume} />
        </Card>

        {/* Members list */}
        <Card className="shadow-card space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">All registered members</h2>
          </div>

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, Moybirr ID"
          />

          <div className="flex flex-wrap gap-2">
            {(["all", "guest", "staff", "owner"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f}
              </Button>
            ))}
          </div>

          {membersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading members…</p>
          ) : filteredMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found.</p>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((m) => (
                <div key={m.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {m.full_name || "No name"}
                      </p>
                      <p className="text-xs text-muted-foreground
