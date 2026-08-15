import { createFileRoute } from "@tanstack/react-router";
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

// Deliberately a route inside the same app, not a separate codebase: it
// reuses the exact same auth session and the exact same RLS/RPC security
// model as everything else, instead of standing up a second app with its
// own login (and its own attack surface) that has to be kept in sync by
// hand. Access is gated server-side - admin_platform_stats() and the
// block/unblock RPCs all check has_role(auth.uid(), 'admin') themselves,
// so this page is safe even though it isn't hidden behind client-side
// routing tricks.
function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    enabled: !!user,
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
      const { error } = await supabase.rpc("admin_unblock_user", { _target_moybirr_id: targetId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${targetId} unblocked`);
      setTargetId("");
      void qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading) return null;
  if (!user) return <div className="p-6 text-sm text-muted-foreground">Sign in first.</div>;
  if (statsQuery.isError) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You don't have access to this page.
      </div>
    );
  }

  const s = statsQuery.data;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-xl font-bold">Moybirr admin</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Guests" value={s?.guests} />
        <Stat label="Staff" value={s?.staff} />
        <Stat label="Owners" value={s?.owners} />
        <Stat label="Hotels" value={s?.hotels} />
        <Stat label="Blocked users" value={s?.blocked_users} />
        <Stat label="Pending deposits" value={s?.pending_deposits} />
        <Stat label="Pending payouts" value={s?.pending_payouts} />
        <Stat label="Total volume (ETB)" value={s?.total_transaction_volume} />
        <Stat label="Platform revenue (ETB)" value={s?.platform_revenue} />
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <h2 className="text-sm font-semibold">Block / unblock a user</h2>
        <p className="text-xs text-muted-foreground">
          Look them up by their Moybirr ID (e.g. MG-000042), not name or phone — it's unambiguous and it's what shows on their receipts.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="tid">Moybirr ID</Label>
          <Input id="tid" value={targetId} onChange={(e) => setTargetId(e.target.value.toUpperCase())} placeholder="MG-000042" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason (for the audit log)</Label>
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. repeated chargebacks" />
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" disabled={!targetId || blockMutation.isPending} onClick={() => blockMutation.mutate()}>
            Block
          </Button>
          <Button variant="outline" disabled={!targetId || unblockMutation.isPending} onClick={() => unblockMutation.mutate()}>
            Unblock
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value ?? "—"}</div>
    </div>
  );
}
