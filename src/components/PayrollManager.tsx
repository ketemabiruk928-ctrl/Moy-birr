import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  CalendarClock,
  Clock,
  DollarSign,
  Loader2,
  CheckCircle2,
  Users,
  RefreshCw,
  UserCircle,
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang, formatETB } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { PayrollReport } from "@/components/PayrollReport";
import { AddStaffDialog } from "@/components/AddStaffDialog";
import { SetSalaryDialog } from "@/components/SetSalaryDialog";

type StaffOption = {
  staff_profile_id: string;
  full_name: string | null;
  position: string | null;
  employment_status?: string;
};

type Shift = {
  id: string;
  staff_profile_id: string;
  staff_name: string | null;
  job_position: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  role: string | null;
  status: string;
  notes: string | null;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  hours_worked: number | null;
};

type AttendanceRow = {
  id: string;
  staff_profile_id: string;
  staff_name: string | null;
  job_position: string | null;
  clocked_in_at: string;
  clocked_out_at: string | null;
  hours_worked: number | null;
  late_minutes: number | null;
  shift_date: string | null;
};

type StaffRow = {
  id: number;
  employee_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  active: boolean;
  hired_at: string | null;
  latest_salary: {
    pay_type: "monthly" | "hourly";
    base_salary: number;
    hourly_rate: number;
    transport_allowance: number;
    other_allowance: number;
    effective_from: string;
  } | null;
};

export function PayrollManager({ hotelId }: { hotelId: string }) {
  const { t } = useLang();
  const [tab, setTab] = useState<"shifts" | "staff" | "attendance" | "payroll">(
    "shifts",
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto">
        <Button
          size="sm"
          variant={tab === "shifts" ? "default" : "outline"}
          onClick={() => setTab("shifts")}
          className="shrink-0"
        >
          <CalendarClock className="mr-2 size-4" />
          {t("payroll.shifts_title")}
        </Button>
        <Button
          size="sm"
          variant={tab === "staff" ? "default" : "outline"}
          onClick={() => setTab("staff")}
          className="shrink-0"
        >
          <Users className="mr-2 size-4" />
          Staff
        </Button>
        <Button
          size="sm"
          variant={tab === "attendance" ? "default" : "outline"}
          onClick={() => setTab("attendance")}
          className="shrink-0"
        >
          <Clock className="mr-2 size-4" />
          {t("payroll.attendance_title")}
        </Button>
        <Button
          size="sm"
          variant={tab === "payroll" ? "default" : "outline"}
          onClick={() => setTab("payroll")}
          className="shrink-0"
        >
          <DollarSign className="mr-2 size-4" />
          {t("payroll.payroll_title")}
        </Button>
      </div>

      {tab === "shifts" ? <ShiftScheduler hotelId={hotelId} /> : null}
      {tab === "staff" ? <StaffView hotelId={hotelId} /> : null}
      {tab === "attendance" ? <AttendanceView hotelId={hotelId} /> : null}
      {tab === "payroll" ? <PayslipsView hotelId={hotelId} /> : null}
    </div>
  );
}

/* ============================================================
 * STAFF VIEW
 * ============================================================ */
function StaffView({ hotelId }: { hotelId: string }) {
  const qc = useQueryClient();

  const staff = useQuery({
    queryKey: ["hotel-staff", hotelId],
    queryFn: async () => {
      const { data: staffData, error: staffErr } = await supabase
        .from("staff")
        .select(
          "id, employee_code, full_name, email, phone, position, active, hired_at, hotel_id",
        )
        .eq("hotel_id", hotelId)
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (staffErr) throw staffErr;
      if (!staffData || staffData.length === 0) return [] as StaffRow[];

      const staffIds = staffData.map((s) => s.id);
      const { data: salaryData, error: salErr } = await supabase
        .from("staff_salary")
        .select(
          "staff_id, pay_type, base_salary, hourly_rate, transport_allowance, other_allowance, effective_from",
        )
        .in("staff_id", staffIds)
        .order("effective_from", { ascending: false });

      if (salErr) throw salErr;

      const merged: StaffRow[] = staffData.map((s) => {
        const latest =
          (salaryData ?? []).find((sal) => sal.staff_id === s.id) ?? null;
        return {
          id: s.id,
          employee_code: s.employee_code,
          full_name: s.full_name || "New Staff",
          email: s.email,
          phone: s.phone,
          position: s.position,
          active: s.active,
          hired_at: s.hired_at,
          latest_salary: latest,
        };
      });

      return merged;
    },
  });

  const removeStaff = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("staff")
        .update({ active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Staff member removed");
      void qc.invalidateQueries({ queryKey: ["hotel-staff", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <AddStaffDialog hotelId={hotelId} />

      <Card className="shadow-card flex items-center justify-between p-3">
        <p className="text-xs text-muted-foreground">
          {(staff.data ?? []).length} staff member
          {(staff.data ?? []).length === 1 ? "" : "s"}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => staff.refetch()}
          disabled={staff.isFetching}
        >
          <RefreshCw
            className={`size-3.5 ${staff.isFetching ? "animate-spin" : ""}`}
          />
        </Button>
      </Card>

      {staff.isLoading ? (
        <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto size-5 animate-spin" />
        </Card>
      ) : (staff.data ?? []).length === 0 ? (
        <Card className="shadow-card flex flex-col items-center gap-2 p-6 text-center">
          <Users className="size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No staff yet. Tap "Add Staff Member" to get started.
          </p>
        </Card>
      ) : (
        (staff.data ?? []).map((s) => {
          const sal = s.latest_salary;
          const payLabel = sal
            ? sal.pay_type === "monthly"
              ? `${formatETB(sal.base_salary)} / month`
              : `${formatETB(sal.hourly_rate)} / hour`
            : "No salary set";

          return (
            <Card key={s.id} className="shadow-card space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent">
                    <UserCircle className="size-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {s.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.position || "Staff"} · {s.employee_code}
                    </p>
                    {s.phone ? (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Phone className="size-3" />
                        {s.phone}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant={sal ? "secondary" : "outline"}
                    className="capitalize text-[10px]"
                  >
                    {sal?.pay_type || "No salary"}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={removeStaff.isPending}
                    onClick={() => {
                      if (confirm(`Remove ${s.full_name}?`)) {
                        removeStaff.mutate(s.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-muted p-2">
                  <p className="text-[10px] text-muted-foreground">Salary</p>
                  <p className="font-semibold">{payLabel}</p>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <p className="text-[10px] text-muted-foreground">
                    Allowances
                  </p>
                  <p className="font-semibold">
                    {formatETB(
                      Number(sal?.transport_allowance ?? 0) +
                        Number(sal?.other_allowance ?? 0),
                    )}
                  </p>
                </div>
              </div>

              {/* Set/Change Salary button */}
              <SetSalaryDialog
                staffId={s.id}
                staffName={s.full_name}
                existingSalary={sal}
              />
            </Card>
          );
        })
      )}
    </div>
  );
}

/* ============================================================
 * SHIFT SCHEDULER
 * ============================================================ */
function ShiftScheduler({ hotelId }: { hotelId: string }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const fromDate = today;
  const toDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [staffId, setStaffId] = useState("");
  const [shiftDate, setShiftDate] = useState(today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");

  const staff = useQuery({
    queryKey: ["owner-staff-list", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_staff_list", {
        _hotel_id: hotelId,
      });
      if (error) throw error;
      return (data ?? []) as StaffOption[];
    },
  });

  const activeStaff = (staff.data ?? []).filter(
    (s) => s.employment_status === "active",
  );

  const shifts = useQuery({
    queryKey: ["owner-shifts", hotelId, fromDate, toDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_shifts_for_hotel", {
        _hotel_id: hotelId,
        _from: fromDate,
        _to: toDate,
      });
      if (error) throw error;
      return (data ?? []) as Shift[];
    },
  });

  const createShift = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("create_shift", {
        _hotel_id: hotelId,
        _staff_profile_id: staffId,
        _shift_date: shiftDate,
        _start_time: startTime,
        _end_time: endTime,
        _role: role || null,
        _notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("payroll.shift_scheduled"));
      setOpen(false);
      setStaffId("");
      setRole("");
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["owner-shifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteShift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_shift", { _shift_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("payroll.shift_deleted"));
      void qc.invalidateQueries({ queryKey: ["owner-shifts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full">
            <Plus className="mr-2 size-4" />
            {t("payroll.new_shift")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("payroll.new_shift")}</DialogTitle>
            <DialogDescription>{t("payroll.shifts_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("payroll.staff_label")}</Label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full rounded-md border border-border bg-background p-2 text-sm"
              >
                <option value="">{t("payroll.select_staff")}</option>
                {activeStaff.map((s) => (
                  <option key={s.staff_profile_id} value={s.staff_profile_id}>
                    {s.full_name || t("staff_member")} · {s.position || "staff"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("payroll.shift_date")}</Label>
              <Input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("payroll.start_time")}</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("payroll.end_time")}</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("payroll.role_optional")}</Label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="waiter, reception…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("payroll.notes_optional")}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              disabled={!staffId || !shiftDate || createShift.isPending}
              onClick={() => createShift.mutate()}
            >
              {createShift.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("payroll.schedule_btn")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="shadow-card flex items-center justify-between p-3">
        <p className="text-xs text-muted-foreground">
          {(shifts.data ?? []).length} {t("payroll.shifts_title").toLowerCase()}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => shifts.refetch()}
          disabled={shifts.isFetching}
        >
          <RefreshCw
            className={`size-3.5 ${shifts.isFetching ? "animate-spin" : ""}`}
          />
        </Button>
      </Card>

      {shifts.isLoading ? (
        <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto size-5 animate-spin" />
        </Card>
      ) : (shifts.data ?? []).length === 0 ? (
        <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
          {t("payroll.no_shifts")}
        </Card>
      ) : (
        (shifts.data ?? []).map((s) => (
          <Card key={s.id} className="shadow-card space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {s.staff_name || t("staff_member")}
                </p>
                <p className="text-xs capitalize text-muted-foreground">
                  {s.job_position || s.role || "staff"}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="size-3" />
                  {s.shift_date} · {s.start_time?.slice(0, 5)} →{" "}
                  {s.end_time?.slice(0, 5)}
                </p>
                {s.clocked_in_at ? (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-success">
                    <CheckCircle2 className="size-3" />
                    {t("payroll.clocked_in")}
                    {s.clocked_out_at
                      ? ` → ${t("payroll.clocked_out")} (${s.hours_worked}h)`
                      : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="secondary" className="capitalize text-[10px]">
                  {t(`payroll.status_${s.status}`) || s.status}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={deleteShift.isPending}
                  onClick={() => deleteShift.mutate(s.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

/* ============================================================
 * ATTENDANCE VIEW
 * ============================================================ */
function AttendanceView({ hotelId }: { hotelId: string }) {
  const { t } = useLang();
  const qc = useQueryClient();

  const fromDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const toDate = new Date().toISOString().slice(0, 10);

  const attendance = useQuery({
    queryKey: ["owner-attendance", hotelId, fromDate, toDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_attendance_for_hotel", {
        _hotel_id: hotelId,
        _from: fromDate,
        _to: toDate,
      });
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });

  return (
    <div className="space-y-3">
      <Card className="shadow-card flex items-center justify-between p-3">
        <div>
          <p className="text-sm font-semibold">
            {t("payroll.attendance_title")}
          </p>
          <p className="text-xs text-muted-foreground">Last 7 days</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => qc.invalidateQueries({ queryKey: ["owner-attendance"] })}
          disabled={attendance.isFetching}
        >
          <RefreshCw
            className={`size-3.5 ${attendance.isFetching ? "animate-spin" : ""}`}
          />
        </Button>
      </Card>

      {attendance.isLoading ? (
        <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto size-5 animate-spin" />
        </Card>
      ) : (attendance.data ?? []).length === 0 ? (
        <Card className="shadow-card flex flex-col items-center gap-2 p-6 text-center">
          <Users className="size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No attendance records yet.
          </p>
        </Card>
      ) : (
        (attendance.data ?? []).map((a) => {
          const isActive = a.clocked_in_at && !a.clocked_out_at;
          return (
            <Card key={a.id} className="shadow-card space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {a.staff_name || t("staff_member")}
                  </p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {a.job_position || "staff"}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {new Date(a.clocked_in_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {a.clocked_out_at
                      ? ` → ${new Date(a.clocked_out_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : " · active"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {isActive ? (
                    <Badge variant="default" className="text-[10px]">
                      On shift
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      {Number(a.hours_worked ?? 0).toFixed(2)}h
                    </Badge>
                  )}
                  {a.late_minutes && a.late_minutes > 0 ? (
                    <p className="mt-1 text-[10px] text-destructive">
                      {a.late_minutes} min late
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] text-success">
                      {t("payroll.on_time")}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

/* ============================================================
 * PAYSLIPS VIEW (Ethiopian Tax System)
 * ============================================================ */
function PayslipsView({ hotelId }: { hotelId: string }) {
  const { t } = useLang();
  const qc = useQueryClient();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [loadingPeriod, setLoadingPeriod] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const findOrCreate = async () => {
      setLoadingPeriod(true);
      try {
        const startDate = `${month}-01`;
        const [y, m] = month.split("-").map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;

        const { data: existing, error: findErr } = await supabase
          .from("payroll_periods")
          .select("id")
          .eq("start_date", startDate)
          .eq("end_date", endDate)
          .order("id", { ascending: true })
          .limit(1);

        if (findErr) throw findErr;

        if (existing && existing.length > 0) {
          setPeriodId(existing[0].id);
        } else {
          const { data: created, error: createErr } = await supabase
            .from("payroll_periods")
            .insert({
              start_date: startDate,
              end_date: endDate,
              status: "open",
            })
            .select("id")
            .single();
          if (createErr) throw createErr;
          setPeriodId(created.id);
        }
      } catch (e: any) {
        toast.error(e.message);
        setPeriodId(null);
      } finally {
        setLoadingPeriod(false);
      }
    };

    findOrCreate();
  }, [month]);

  const generate = useMutation({
    mutationFn: async () => {
      if (!periodId) throw new Error("No payroll period available");
      const { error } = await supabase.rpc("generate_payroll_for_period", {
        p_period_id: periodId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payroll generated successfully!");
      setRefreshKey((k) => k + 1);
      void qc.invalidateQueries({ queryKey: ["payroll-report"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <Card className="shadow-card space-y-3 p-4">
        <div className="space-y-1.5">
          <Label>{t("payroll.month") || "Month"}</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          disabled={generate.isPending || !periodId || loadingPeriod}
          onClick={() => generate.mutate()}
        >
          {generate.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <DollarSign className="mr-2 size-4" />
          )}
          {t("payroll.generate_payroll") || "Generate payslips"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Auto-calculate monthly salaries with Ethiopian income tax.
        </p>
      </Card>

      {loadingPeriod ? (
        <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto size-5 animate-spin" />
        </Card>
      ) : periodId ? (
        <PayrollReport key={`${periodId}-${refreshKey}`} periodId={periodId} />
      ) : (
        <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
          Could not load payroll period.
        </Card>
      )}
    </div>
  );
}