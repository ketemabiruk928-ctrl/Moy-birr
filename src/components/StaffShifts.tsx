import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock,
  LogIn,
  LogOut,
  Clock,
  CheckCircle2,
  Loader2,
  FileText,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang, formatETB } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type MyShift = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role: string | null;
  status: string;
  notes: string | null;
  hotel_name: string | null;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  hours_worked: number | null;
};

type MyPayroll = {
  id: string;
  month: string;
  base_salary: number;
  tips_earned: number;
  hours_worked: number;
  shifts_worked: number;
  net_pay: number;
  status: string;
  paid_at: string | null;
  hotel_name: string | null;
};

export function StaffShifts() {
  const { t } = useLang();
  const [tab, setTab] = useState<"shifts" | "payslips">("shifts");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={tab === "shifts" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setTab("shifts")}
        >
          <CalendarClock className="mr-2 size-4" />
          {t("payroll.my_shifts")}
        </Button>
        <Button
          size="sm"
          variant={tab === "payslips" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setTab("payslips")}
        >
          <FileText className="mr-2 size-4" />
          {t("payroll.my_payslips")}
        </Button>
      </div>

      {tab === "shifts" ? <MyShiftsList /> : <MyPayslips />}
    </div>
  );
}

/* ============================================================
 * MY SHIFTS
 * ============================================================ */
function MyShiftsList() {
  const { t } = useLang();
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const toDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const shifts = useQuery({
    queryKey: ["my-shifts", today, toDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_my_shifts", {
        _from: today,
        _to: toDate,
      });
      if (error) throw error;
      return (data ?? []) as MyShift[];
    },
  });

  const clockIn = useMutation({
    mutationFn: async (shiftId: string) => {
      // Try to get GPS
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // No GPS — continue without it
      }
      const { error } = await supabase.rpc("clock_in", {
        _shift_id: shiftId,
        _lat: lat,
        _lng: lng,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("payroll.clocked_in_success"));
      void qc.invalidateQueries({ queryKey: ["my-shifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clockOut = useMutation({
    mutationFn: async () => {
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // No GPS — continue without it
      }
      const { error } = await supabase.rpc("clock_out", {
        _lat: lat,
        _lng: lng,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("payroll.clocked_out_success", { hours: "—" }));
      void qc.invalidateQueries({ queryKey: ["my-shifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (shifts.isLoading) {
    return (
      <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto size-5 animate-spin" />
      </Card>
    );
  }

  if ((shifts.data ?? []).length === 0) {
    return (
      <Card className="shadow-card flex flex-col items-center gap-2 p-6 text-center">
        <CalendarClock className="size-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("payroll.no_shifts")}</p>
      </Card>
    );
  }

  const now = new Date();

  return (
    <div className="space-y-3">
      {(shifts.data ?? []).map((s) => {
        const shiftStart = new Date(`${s.shift_date}T${s.start_time}`);
        const shiftEnd = new Date(`${s.shift_date}T${s.end_time}`);
        const isToday = s.shift_date === today;
        const isActive = s.clocked_in_at && !s.clocked_out_at;
        const canClockIn =
          !s.clocked_in_at &&
          isToday &&
          now >= new Date(shiftStart.getTime() - 30 * 60 * 1000) && // 30 min early
          now <= new Date(shiftStart.getTime() + 4 * 60 * 60 * 1000); // 4hr late limit

        return (
          <Card key={s.id} className="shadow-card space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{s.hotel_name || "Hotel"}</p>
                  {isToday ? (
                    <Badge variant="secondary" className="text-[9px]">
                      TODAY
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs capitalize text-muted-foreground">
                  {s.role || "Staff"}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="size-3" />
                  {s.shift_date} · {s.start_time?.slice(0, 5)} →{" "}
                  {s.end_time?.slice(0, 5)}
                </p>
                {s.clocked_in_at ? (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-success">
                    <CheckCircle2 className="size-3" />
                    {t("payroll.clocked_in")}{" "}
                    {s.clocked_out_at
                      ? `→ ${t("payroll.clocked_out")} · ${s.hours_worked}h`
                      : ""}
                  </p>
                ) : null}
                {s.notes ? (
                  <p className="mt-1 text-[11px] text-muted-foreground italic">
                    {s.notes}
                  </p>
                ) : null}
              </div>
              <Badge
                variant="secondary"
                className="shrink-0 capitalize text-[10px]"
              >
                {t(`payroll.status_${s.status}`) || s.status}
              </Badge>
            </div>

            {/* Action buttons */}
            {canClockIn ? (
              <Button
                className="w-full"
                disabled={clockIn.isPending}
                onClick={() => clockIn.mutate(s.id)}
              >
                {clockIn.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 size-4" />
                )}
                {t("payroll.clock_in_btn")}
              </Button>
            ) : null}

            {isActive ? (
              <Button
                variant="outline"
                className="w-full"
                disabled={clockOut.isPending}
                onClick={() => clockOut.mutate()}
              >
                {clockOut.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 size-4" />
                )}
                {t("payroll.clock_out_btn")}
              </Button>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

/* ============================================================
 * MY PAYSLIPS
 * ============================================================ */
function MyPayslips() {
  const { t } = useLang();

  const payslips = useQuery({
    queryKey: ["my-payslips"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_my_payroll");
      if (error) throw error;
      return (data ?? []) as MyPayroll[];
    },
  });

  if (payslips.isLoading) {
    return (
      <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto size-5 animate-spin" />
      </Card>
    );
  }

  if ((payslips.data ?? []).length === 0) {
    return (
      <Card className="shadow-card flex flex-col items-center gap-2 p-6 text-center">
        <FileText className="size-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("payroll.no_payslips")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {(payslips.data ?? []).map((p) => (
        <Card key={p.id} className="shadow-card space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{p.hotel_name || "Hotel"}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(p.month).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <Badge
              variant={
                p.status === "paid"
                  ? "secondary"
                  : p.status === "approved"
                    ? "default"
                    : "outline"
              }
              className="capitalize text-[10px]"
            >
              {t(`payroll.status_${p.status}`) || p.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-muted p-2">
              <p className="text-[10px] text-muted-foreground">
                {t("payroll.base_salary")}
              </p>
              <p className="font-semibold">{formatETB(p.base_salary)}</p>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <p className="text-[10px] text-muted-foreground">
                {t("payroll.tips")}
              </p>
              <p className="font-semibold">{formatETB(p.tips_earned)}</p>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <p className="text-[10px] text-muted-foreground">
                {t("payroll.hours")}
              </p>
              <p className="font-semibold">
                {Number(p.hours_worked).toFixed(1)}h
              </p>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <p className="text-[10px] text-muted-foreground">
                {t("payroll.shifts_worked")}
              </p>
              <p className="font-semibold">{p.shifts_worked}</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">
                {t("payroll.net_pay")}
              </p>
              <p className="text-lg font-bold">{formatETB(p.net_pay)}</p>
            </div>
            {p.status === "paid" && p.paid_at ? (
              <p className="flex items-center gap-1 text-xs text-success">
                <CheckCircle2 className="size-4" />
                {new Date(p.paid_at).toLocaleDateString()}
              </p>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}