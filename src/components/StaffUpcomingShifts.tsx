import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function StaffUpcomingShifts() {
  const { user } = useAuth();

  // Find this user's staff record
  const staffRecord = useQuery({
    queryKey: ["my-staff-record", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name")
        .eq("user_id", user!.id)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Get upcoming + recent shifts
  const shifts = useQuery({
    queryKey: ["my-shifts", staffRecord.data?.id],
    enabled: !!staffRecord.data?.id,
    queryFn: async () => {
      const today = new Date();
      const past = new Date();
      past.setDate(past.getDate() - 7);
      const from = past.toISOString().slice(0, 10);
      const to = new Date(today.getTime() + 30 * 86400000)
        .toISOString()
        .slice(0, 10);

      const { data, error } = await supabase
        .from("staff_shifts")
        .select(
          "id, shift_date, start_time, end_time, role, notes, status",
        )
        .eq("staff_id", staffRecord.data!.id)
        .gte("shift_date", from)
        .lte("shift_date", to)
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (staffRecord.isLoading || shifts.isLoading) {
    return (
      <Card className="shadow-card flex items-center justify-center p-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!staffRecord.data) {
    return (
      <Card className="shadow-card p-4">
        <p className="text-xs text-muted-foreground">
          No staff record linked to your account yet.
        </p>
      </Card>
    );
  }

  if ((shifts.data ?? []).length === 0) {
    return (
      <Card className="shadow-card flex flex-col items-center gap-2 p-6 text-center">
        <CalendarClock className="size-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No shifts scheduled yet.
        </p>
      </Card>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-2">
      {(shifts.data ?? []).map((s) => {
        const isToday = s.shift_date === todayStr;
        const isPast = s.shift_date < todayStr;
        return (
          <Card key={s.id} className="shadow-card space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {s.shift_date}
                  {isToday ? (
                    <Badge variant="default" className="text-[10px]">
                      TODAY
                    </Badge>
                  ) : null}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="size-3" />
                  {s.start_time?.slice(0, 5)} → {s.end_time?.slice(0, 5)}
                  {s.role ? ` · ${s.role}` : ""}
                </p>
                {s.notes ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {s.notes}
                  </p>
                ) : null}
              </div>
              <Badge
                variant={isPast ? "secondary" : "outline"}
                className="shrink-0 capitalize text-[10px]"
              >
                {s.status}
              </Badge>
            </div>
          </Card>
        );
      })}
    </div>
  );
}