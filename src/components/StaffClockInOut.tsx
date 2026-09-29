import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, LogIn, LogOut, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function StaffClockInOut() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // 1. Find this user's staff record
  const staffRecord = useQuery({
    queryKey: ["my-staff-record", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name, position, hotel_id")
        .eq("user_id", user!.id)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // 2. Is there an open shift? (clocked in but not out)
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

  // 3. Today's total hours (for context)
  const todayTotal = useQuery({
    queryKey: ["my-today-total", staffRecord.data?.id],
    enabled: !!staffRecord.data?.id,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("staff_attendance")
        .select("total_minutes")
        .eq("staff_id", staffRecord.data!.id)
        .eq("status", "completed")
        .gte("clock_in", `${today}T00:00:00`)
        .lte("clock_in", `${today}T23:59:59`);
      if (error) throw error;
      const total = (data ?? []).reduce(
        (s, r) => s + Number(r.total_minutes ?? 0),
        0,
      );
      return total;
    },
  });

  // 4. Clock IN
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
      toast.success("Clocked in successfully");
      void qc.invalidateQueries({ queryKey: ["my-open-shift"] });
      void qc.invalidateQueries({ queryKey: ["my-today-total"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // 5. Clock OUT — calculates total minutes
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
      toast.success("Clocked out. Shift saved.");
      void qc.invalidateQueries({ queryKey: ["my-open-shift"] });
      void qc.invalidateQueries({ queryKey: ["my-today-total"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (staffRecord.isLoading) {
    return (
      <Card className="shadow-card flex items-center justify-center p-4">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  // Not linked to a payroll staff record yet
  if (!staffRecord.data) {
    return (
      <Card className="shadow-card p-4">
        <p className="text-xs text-muted-foreground">
          Your payroll profile is being set up. Contact your hotel owner.
        </p>
      </Card>
    );
  }

  const isClockedIn = !!openShift.data;
  const clockInTime = openShift.data ? new Date(openShift.data.clock_in) : null;
  const todayHours = Number(todayTotal.data ?? 0) / 60;

  return (
    <Card className="shadow-card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
          <div>
            <p className="text-sm font-semibold">
              {isClockedIn ? "You are clocked in" : "Not clocked in"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isClockedIn && clockInTime
                ? `Since ${clockInTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : `${todayHours.toFixed(2)}h worked today`}
            </p>
          </div>
        </div>
      </div>

      {isClockedIn ? (
        <Button
          className="w-full"
          variant="destructive"
          size="lg"
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