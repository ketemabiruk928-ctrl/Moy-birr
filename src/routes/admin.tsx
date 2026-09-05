import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

// Only this phone account can use admin
const ADMIN_PHONE_EMAIL = "0963154217@moybirr.app";

function AdminPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const qc = useQueryClient();
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");

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

  const movementsQuery = useQuery({
    queryKey: ["admin-movements"],
    enabled: isAllowedAdmin,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, created_at, type, amount, note")
        .order("created_at", { ascending: false })
        .limit(100);
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
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p>Loading…</p>
      </div>
    );
  }

  // Not logged in with admin phone
  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold">Moybirr Admin</h1>
        <p className="text-sm text-muted-foreground">
          Log in with your admin phone number first, then open this page again.
        </p>
        <Button asChild>
          <Link to="/auth">Go to login</Link>
        </Button>
      </div>
    );
  }

  if (!isAllowedAdmin) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-bold">Access denied</h1>
        <p className="text-sm text-muted-foreground">
          This account is not the authorized admin phone.
        </p>
        <p className="text-xs text-muted-foreground">Current: {user.email}</p>
        <Button variant="outline" onClick={() => void signOut()}>
          Log out and try admin phone
        </Button>
      </div>
    );
  }

  const stats = statsQuery.data;

  return (
    <div className="mx-auto min-h-screen w-full max-w-lg space-y-5 bg-background px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Moybirr Admin</h1>
          <p className="text-xs text-muted-foreground">Phone admin · {user.email}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void signOut()}>
          Log out
        </Button>
      </div>

      {statsQuery.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          Could not load stats. Check admin role in Supabase.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Guests" value={stats?.guests} />
          <Stat label="Staff" value={stats?.staff} />
          <Stat label="Owners" value={stats?.owners} />
          <Stat label="Hotels" value={stats?.hotels} />
          <Stat label="Blocked users" value={stats?.blocked_users} />
          <Stat label="Pending deposits" value={stats?.pending_deposits} />
          <Stat label="Pending payouts" value={stats?.pending_payouts} />
          <Stat label="Total volume (ETB)" value={stats?.total_transaction_volume} />
          <Stat label="Platform revenue (ETB)" value={stats?.platform_revenue} />
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">Block / Unblock member</h2>
        <p className="text-xs text-muted-foreground">Use Moybirr ID (example MG-000042)</p>

        <div className="space-y-1.5">
          <Label htmlFor="tid">Moybirr ID</Label>
          <Input
            id="tid"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value.toUpperCase())}
            placeholder="MG-000042"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="fraud / abuse"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="destructive"
            disabled={!targetId || blockMutation.isPending}
            onClick={() => blockMutation.mutate()}
          >
            Block
          </Button>
          <Button
            variant="outline"
            disabled={!targetId || unblockMutation.isPending}
            onClick={() => unblockMutation.mutate()}
          >
            Unblock
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">All movements</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void qc.invalidateQueries({ queryKey: ["admin-movements"] });
              void qc.invalidateQueries({ queryKey: ["admin-stats"] });
            }}
          >
            Refresh
          </Button>
        </div>

        {(movementsQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {(movementsQuery.data ?? []).map((m) => (
              <div key={m.id} className="rounded-lg border border-border px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold capitalize">{m.type}</span>
                  <span className="font-bold">{Number(m.amount).toFixed(2)} ETB</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {new Date(m.created_at).toLocaleString()}
                </p>
                {m.note ? <p className="mt-1">{m.note}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value ?? "—"}</p>
    </div>
  );
}      
