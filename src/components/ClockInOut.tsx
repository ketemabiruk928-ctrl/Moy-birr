import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, LogIn, LogOut, Loader2, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ClockInOut() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // 1. Find the staff record linked to this logged-in user
  const staffRecord = useQuery({
    queryKey: ["my-staff-record", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name, position")
        .eq("user_id", user!.id)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // 2. Check if there's an open shift (clocked in, not yet out)
  const openShift = useQuery({
    queryKey: ["my-open-shift", staffRecord.data?.id],
    enabled: !!staffRecord.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_attendance")
        .select("id, clock_in, clock_out, total_minutes, status")
        .eq("staff_id", staffRecord.data!.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  // 3. Clock IN
  const clockIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff_attendance").insert({
        staff_id: staffRecord.data!.id,
        clock_in: new Date().toISOString(),
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clocked in! Have a good shift.");
      void qc.invalidateQueries({ queryKey: ["my-open-shift"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // 4. Clock OUT (calculates total minutes)
  const clockOut = useMutation({
    mutationFn: async () => {
      const shift = openShift.data!;
      const now = new Date();
      const started = new Date(shift.clock_in);
      const totalMinutes = Math.max(
        0,
        Math.floor((now.getTime() - started.getTime()) / 60000),
      );

      const { error } = await supabase
        .from("staff_attendance")
        .update({
          clock_out: now.toISOString(),
          total_minutes: totalMinutes,
          status: "completed",
        })
        .eq("id", shift.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clocked out. See you next shift!");
      void qc.invalidateQueries({ queryKey: ["my-open-shift"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Handle load states
  if (staffRecord.isLoading) {
    return (
      <Card className="shadow-card flex items-center justify-center p-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  // Not linked to any staff record
  if (!staffRecord.data) {
    return (
      <Card className="shadow-card flex items-start gap-3 p-4">
        <UserX className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">Not registered as staff</p>
          <p className="text-xs text-muted-foreground">
            Ask the hotel owner to approve your staff account first.
          </p>
        </div>
      </Card>
    );
  }

  const isClockedIn = !!openShift.data;
  const clockInTime = openShift.data
    ? new Date(openShift.data.clock_in)
    : null;

  return (
    <Card className="shadow-card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            {staffRecord.data.full_name}
          </p>
          <p className="text-xs capitalize text-muted-foreground">
            {staffRecord.data.position || "Staff"}
          </p>
        </div>
        <div
          className={`flex size-10 items-center justify-center rounded-full ${
            isClockedIn ? "bg-success/20" : "bg-muted"
          }`}
        >
          <Clock
            className={`size-5 ${
              isClockedIn ? "text-success" : "text-muted-foreground"
            }`}
          />
        </div>
      </div>

      {isClockedIn && clockInTime ? (
        <>
          <div className="rounded-lg bg-success/10 p-3">
            <p className="text-[11px] uppercase text-success">
              Currently clocked in
            </p>
            <p className="text-sm font-semibold">
              Since{" "}
              {clockInTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <Button
            className="w-full"
            size="lg"
            variant="destructive"
            disabled={clockOut.isPending}
            onClick={() => clockOut.mutate()}
          >
            {clockOut.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 size-4" />
            )}
            Clock Out
          </Button>
        </>
      ) : (
        <Button
          className="w-full"
          size="lg"
          disabled={clockIn.isPending}
          onClick={() => clockIn.mutate()}
        >
          {clockIn.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <LogIn className="mr-2 size-4" />
          )}
          Clock In
        </Button>
      )}
    </Card>
  );
}