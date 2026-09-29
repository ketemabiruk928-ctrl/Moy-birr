import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  CalendarClock,
  Clock,
  DollarSign,
  Loader2,
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

type ShiftRow = {
  id: number;
  staff_id: number;
  shift_date: string;
  start_time: string;
  end_time: string;
  role: string | null;
  notes: string | null;
  status: string;
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
          Shift Scheduler
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
          Attendance
        </Button>
        <Button
          size="sm"
          variant={tab === "payroll" ? "default" : "outline"}
          onClick={() => setTab("payroll")}
          className="shrink-0"
        >
          <DollarSign className="mr-2 size-4" />
          Payroll
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
 * SHIFT SCHEDULER — reads from staff_shifts
 * ============================================================ */
function ShiftScheduler({ hotelId }: { hotelId: string }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [staffId, setStaffId] = useState("");
  const [shiftDate, setShiftDate] = useState(today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");

  // Active staff for this hotel
  const staff = useQuery({
    queryKey: ["hotel-staff", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name, position, employee_code")
        .eq("hotel_id", hotelId)
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // All shifts for the next 60 days
  const shifts = useQuery({
    queryKey: ["hotel-shifts", hotelId],
    queryFn: async () => {
      const from = new Date(Date.now() - 30 * 86400000)
        .toISOString()
        .slice(0, 10);
      const to = new Date(Date.now() + 60 * 86400000)
        .toISOString()
        .slice(0, 10);

      const { data, error } = await supabase
        .from("staff_shifts")
        .select(
          "id, staff_id, shift_date, start_time, end_time, role, notes, status",
        )
        .eq("hotel_id", hotelId)
        .gte("shift_date", from)
        .lte("shift_date", to)
        .order("shift_date", { ascending: false })
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Merge staff names into shifts
  const staffMap = useMemo(() => {
    const map = new Map<number, { name: string; position: string | null }>();
    (staff.data ?? []).forEach((s) => {
      map.set(s.id, {
        name: s.full_name || "Staff",
        position: s.position,
      });
    });
    return map;
  }, [staff.data]);

  const createShift = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff_shifts").insert({
        staff_id: Number(staffId),
        hotel_id: hotelId,
        shift_date: shiftDate,
        start_time: startTime,
        end_time: endTime,
        role: role || null,
        notes: notes || null,
        status: "scheduled",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift scheduled");
      setOpen(false);
      setStaffId("");
      setRole("");
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["hotel-shifts", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteShift = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("staff_shifts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift deleted");
      void qc.invalidateQueries({ queryKey: ["hotel-shifts", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const todayStr = today;

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full">
            <Plus className="mr-2 size-4" />
            New Shift
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule a Shift</DialogTitle>
            <DialogDescription>
              Assign a shift to a staff member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Staff Member</Label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full rounded-md border border-border bg-background p-2 text-sm"
              >
                <option value="">Select staff…</option>
                {(staff.data ?? []).map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.full_name} · {s.position || "staff"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Role (optional)</Label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="waiter, reception…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
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
                "Schedule Shift"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="shadow-card flex items-center justify-between p-3">
        <p className="text-xs text-muted-foreground">
          {(shifts.data ?? []).length} shift
          {(shifts.data ?? []).length === 1 ? "" : "s"}
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
          No shifts scheduled yet.
        </Card>
      ) : (
        (shifts.data ?? []).map((s) => {
          const info = staffMap.get(s.staff_id);
          const isToday = s.shift_date === todayStr;
          return (
            <Card key={s.id} className="shadow-card space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {info?.name || "Unknown"}
                    {isToday ? (
                      <Badge variant="default" className="text-[10px]">
                        TODAY
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {info?.position || s.role || "staff"}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3" />
                    {s.shift_date} · {s.start_time?.slice(0, 5)} →{" "}
                    {s.end_time?.slice(0, 5)}
                  </p>
                  {s.notes ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {s.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    {s.status}
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
          );
        })
      )}
    </div>
  );
}

/* ============================================================
 * STAFF VIEW
 * ============================================================ */
function StaffView({ hotelId }: { hotelId: string }) {
  const qc = useQueryClient();

  const staff = useQuery({
    queryKey: ["hotel-staff-full", hotelId],
    queryFn: async () => {
      const { data: staffData, error: staffErr } = await supabase
        .from("staff")
        .select(
          "id, employee_code, full_name, email, phone, position, active, hired_at",
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

      return staffData.map((s) => ({
        id: s.id,
        employee_code: s.employee_code,
        full_name: s.full_name || "New Staff",
        email: s.email,
        phone: s.phone,
        position: s.position,
        active: s.active,
        hired_at: s.hired_at,
        latest_salary:
          (salaryData ?? []).find((sal) => sal.staff_id === s.id) ?? null,
      })) as StaffRow[];
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
      void qc.invalidateQueries({ queryKey: ["hotel-staff-full", hotelId] });
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
            No staff yet. Tap "Add Staff Member".
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
 * ATTENDANCE VIEW
 * ============================================================ */
function AttendanceView({ hotelId }: { hotelId: string }) {
  const qc = useQueryClient();

  const { fromDate, toDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 14);
    return {
      fromDate: start.toISOString(),
      toDate: end.toISOString(),
    };
  }, []);

  const attendance = useQuery({
    queryKey: ["owner-attendance-new", hotelId, fromDate, toDate],
    queryFn: async () => {
      const { data: staffData, error: staffErr } = await supabase
        .from("staff")
        .select("id, full_name, employee_code, position")
        .eq("hotel_id", hotelId)
        .eq("active", true);
      if (staffErr) throw staffErr;

      const staffMap = new Map((staffData ?? []).map((s) => [s.id, s]));
      const staffIds = Array.from(staffMap.keys());
      if (staffIds.length === 0) return [];

      const { data: attData, error: attErr } = await supabase
        .from("staff_attendance")
        .select("id, staff_id, clock_in, clock_out, total_minutes, status")
        .in("staff_id", staffIds)
        .gte("clock_in", fromDate)
        .lte("clock_in", toDate)
        .order("clock_in", { ascending: false })
        .limit(100);
      if (attErr) throw attErr;

      return (attData ?? []).map((a) => ({
        ...a,
        staff: staffMap.get(a.staff_id) ?? null,
      }));
    },
  });

  return (
    <div className="space-y-3">
      <Card className="shadow-card flex items-center justify-between p-3">
        <div>
          <p className="text-sm font-semibold">Attendance</p>
          <p className="text-xs text-muted-foreground">Last 14 days</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            qc.invalidateQueries({ queryKey: ["owner-attendance-new"] })
          }
          disabled={attendance.isFetching}
        >
          <RefreshCw
            className={`size-3.5 ${
              attendance.isFetching ? "animate-spin" : ""
            }`}
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
        (attendance.data ?? []).map((a: any) => {
          const isActive = a.clock_in && !a.clock_out;
          const clockIn = new Date(a.clock_in);
          const hours = a.total_minutes
            ? (a.total_minutes / 60).toFixed(2)
            : null;
          return (
            <Card key={a.id} className="shadow-card space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {a.staff?.full_name || "Unknown"}
                  </p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {a.staff?.position || "staff"} · {a.staff?.employee_code}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {clockIn.toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {a.clock_out
                      ? ` → ${new Date(a.clock_out).toLocaleTimeString([], {
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
                      {hours ?? "—"}h
                    </Badge>
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
 * PAYSLIPS VIEW
 * ============================================================ */
function PayslipsView({ hotelId }: { hotelId: string }) {
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
          <Label>Month</Label>
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
          Generate payslips
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