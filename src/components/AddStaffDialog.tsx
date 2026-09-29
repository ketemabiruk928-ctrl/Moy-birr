import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

export function AddStaffDialog({ hotelId }: { hotelId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [payType, setPayType] = useState<"monthly" | "hourly">("monthly");
  const [baseSalary, setBaseSalary] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [transport, setTransport] = useState("");
  const [other, setOther] = useState("");

  const reset = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setPosition("");
    setPayType("monthly");
    setBaseSalary("");
    setHourlyRate("");
    setTransport("");
    setOther("");
  };

  const save = useMutation({
    mutationFn: async () => {
      // Auto-generate an employee code
      const code = `EMP${String(Date.now()).slice(-6)}`;

      // 1. Insert into staff table
      const { data: staffRow, error: staffErr } = await supabase
        .from("staff")
        .insert({
          employee_code: code,
          full_name: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          position: position.trim() || null,
          hotel_id: hotelId,
          active: true,
        })
        .select("id")
        .single();

      if (staffErr) throw staffErr;

      // 2. Insert salary record
      const { error: salErr } = await supabase.from("staff_salary").insert({
        staff_id: staffRow.id,
        pay_type: payType,
        base_salary: payType === "monthly" ? Number(baseSalary) || 0 : 0,
        hourly_rate: payType === "hourly" ? Number(hourlyRate) || 0 : 0,
        transport_allowance: Number(transport) || 0,
        other_allowance: Number(other) || 0,
        effective_from: new Date().toISOString().slice(0, 10),
      });

      if (salErr) {
        // Rollback: delete staff if salary insert fails
        await supabase.from("staff").delete().eq("id", staffRow.id);
        throw salErr;
      }
    },
    onSuccess: () => {
      toast.success("Staff member added successfully");
      setOpen(false);
      reset();
      void qc.invalidateQueries({ queryKey: ["hotel-staff", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    fullName.trim().length > 1 &&
    (payType === "monthly" ? Number(baseSalary) > 0 : Number(hourlyRate) > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <UserPlus className="mr-2 size-4" />
          Add Staff Member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
          <DialogDescription>
            Add a new team member and set their salary.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full Name *</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Abebe Kebede"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912 345 678"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Position</Label>
              <Input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="waiter, chef…"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="optional"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Pay Type *</Label>
            <select
              value={payType}
              onChange={(e) => setPayType(e.target.value as "monthly" | "hourly")}
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
            >
              <option value="monthly">Monthly (fixed salary)</option>
              <option value="hourly">Hourly (based on attendance)</option>
            </select>
          </div>

          {payType === "monthly" ? (
            <div className="space-y-1.5">
              <Label>Base Salary (ETB) *</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                placeholder="12000"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Hourly Rate (ETB) *</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="100"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Transport (ETB)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={transport}
                onChange={(e) => setTransport(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Other (ETB)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!canSubmit || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 size-4" />
            )}
            Save Staff Member
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}