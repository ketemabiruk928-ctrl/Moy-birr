import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, Clock, FileText, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatETB } from "@/lib/i18n";

type TxRow = {
  id: string;
  type: string;
  amount: number;
  fiscal_status: string | null;
  irn: string | null;
  rrn: string | null;
  tax_amount: number | null;
  tip_amount: number | null;
  created_at: string;
  fiscal_registered_at: string | null;
};

export function ComplianceDashboard({ hotelId }: { hotelId: string }) {
  const { t } = useLang();

  const txQuery = useQuery({
    queryKey: ["owner-fiscal-transactions", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,type,amount,fiscal_status,irn,rrn,tax_amount,tip_amount,created_at,fiscal_registered_at")
        .eq("hotel_id", hotelId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as TxRow[];
    },
  });

  const hotel = useQuery({
    queryKey: ["my-hotel-fiscal", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotels")
        .select("tin, legal_name, fiscal_provider, compliance_status")
        .eq("id", hotelId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const rows = txQuery.data ?? [];
    const total = rows.length;
    const registered = rows.filter((r) => r.fiscal_status === "registered").length;
    const pending = rows.filter((r) =>
      ["pending", "pending_provider_api", "pending_merchant_tin"].includes(r.fiscal_status ?? ""),
    ).length;
    const failed = rows.filter((r) => r.fiscal_status === "failed").length;
    const totalVolume = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const totalTax = rows.reduce((s, r) => s + Number(r.tax_amount ?? 0), 0);
    return { total, registered, pending, failed, totalVolume, totalTax };
  }, [txQuery.data]);

  const isCompliant = !!hotel.data?.tin && !!hotel.data?.legal_name;

  return (
    <div className="space-y-3">
      {/* Compliance status banner */}
      <Card className={`shadow-card p-4 ${isCompliant ? "border-green-500/40 bg-green-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
        <div className="flex items-start gap-3">
          {isCompliant ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
          ) : (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {isCompliant
                ? t("compliance.status_compliant")
                : t("compliance.status_incomplete")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isCompliant
                ? t("compliance.status_compliant_desc", {
                    provider: hotel.data?.fiscal_provider || "—",
                  })
                : t("compliance.status_incomplete_desc")}
            </p>
            {hotel.data?.tin ? (
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                TIN: {hotel.data.tin}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<CheckCircle2 className="size-4 text-green-600" />}
          label={t("compliance.stat_registered")}
          value={String(stats.registered)}
          tone="green"
        />
        <StatCard
          icon={<Clock className="size-4 text-amber-600" />}
          label={t("compliance.stat_pending")}
          value={String(stats.pending)}
          tone="amber"
        />
        <StatCard
          icon={<AlertTriangle className="size-4 text-destructive" />}
          label={t("compliance.stat_failed")}
          value={String(stats.failed)}
          tone="red"
        />
        <StatCard
          icon={<FileText className="size-4 text-primary" />}
          label={t("compliance.stat_total")}
          value={String(stats.total)}
          tone="primary"
        />
      </div>

      <Card className="shadow-card p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("compliance.volume_30d")}</span>
          <span className="font-semibold">{formatETB(stats.totalVolume)}</span>
        </div>
      </Card>

      {/* Transaction list */}
      <Card className="shadow-card space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t("compliance.recent_transactions")}</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => txQuery.refetch()}
            disabled={txQuery.isFetching}
          >
            <RefreshCw className={`size-3.5 ${txQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {txQuery.isLoading ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {t("compliance.loading")}
          </p>
        ) : (txQuery.data ?? []).length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {t("compliance.no_transactions")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {(txQuery.data ?? []).map((tx) => (
              <div
                key={tx.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium capitalize">{tx.type}</span>
                    <FiscalBadge status={tx.fiscal_status} t={t} />
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {tx.irn ?? "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-bold">{formatETB(tx.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function FiscalBadge({ status, t }: { status: string | null; t: (k: string) => string }) {
  const s = status ?? "pending";
  const variant =
    s === "registered"
      ? "default"
      : s === "failed"
        ? "destructive"
        : "outline";
  const label =
    s === "registered"
      ? t("compliance.badge_registered")
      : s === "failed"
        ? t("compliance.badge_failed")
        : s === "pending_merchant_tin"
          ? t("compliance.badge_tin_missing")
          : s === "pending_provider_api"
            ? t("compliance.badge_awaiting_api")
            : t("compliance.badge_pending");
  return (
    <Badge variant={variant} className="text-[9px] uppercase">
      {label}
    </Badge>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "green" | "amber" | "red" | "primary";
}) {
  const bg = {
    green: "bg-green-500/10",
    amber: "bg-amber-500/10",
    red: "bg-destructive/10",
    primary: "bg-accent",
  }[tone];
  return (
    <Card className="shadow-card p-3">
      <div className={`flex size-8 items-center justify-center rounded-lg ${bg}`}>{icon}</div>
      <p className="mt-2 text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </Card>
  );
}