import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DollarSign, Loader2 } from "lucide-react";
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

export function SetSalaryDialog({
  staffId,
  staffName,
  existingSalary,
}: {
  staffId: number;
  staffName: string;
  existingSalary?: {
    pay_type: "monthly" | "hourly";
    base_salary: number;
    hourly_rate: number;
    transport_allowance: number;
    other_allowance: number;
  } | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [payType, setPayType] = useState<"monthly" | "hourly">(
    existingSalary?.pay_type ?? "monthly",
  );
  const [baseSalary, setBaseSalary] = useState(
    existingSalary?.base_salary ? String(existingSalary.base_salary) : "",
  );
  const [hourlyRate, setHourlyRate] = useState(
    existingSalary?.hourly_rate ? String(existingSalary.hourly_rate) : "",
  );
  const [transport, setTransport] = useState(
    existingSalary?.transport_allowance
      ? String(existingSalary.transport_allowance)
      : "",
  );
  const [other, setOther] = useState(
    existingSalary?.other_allowance
      ? String(existingSalary.other_allowance)
      : "",
  );

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff_salary").insert({
        staff_id: staffId,
        pay_type: payType,
        base_salary: payType === "monthly" ? Number(baseSalary) || 0 : 0,
        hourly_rate: payType === "hourly" ? Number(hourlyRate) || 0 : 0,
        transport_allowance: Number(transport) || 0,
        other_allowance: Number(other) || 0,
        effective_from: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salary saved");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["hotel-staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    payType === "monthly" ? Number(baseSalary) > 0 : Number(hourlyRate) > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <DollarSign className="mr-1 size-3.5" />
          {existingSalary ? "Change Salary" : "Set Salary"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existingSalary ? "Update Salary" : "Set Salary"}
          </DialogTitle>
          <DialogDescription>
            Set the salary for {staffName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
              <DollarSign className="mr-2 size-4" />
            )}
            Save Salary
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}