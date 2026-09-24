import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Receipt, ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatETB, useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/receipts/")({
  head: () => ({
    meta: [
      { title: "My Receipts — Moybirr" },
      { name: "description", content: "Every receipt from your Moybirr payments, tips, and bookings." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <ReceiptsPage />
      </AppShell>
    </RequireAuth>
  ),
});

function ReceiptsPage() {
  const { t } = useLang();
  const { user } = useAuth();

  const receipts = useQuery({
    queryKey: ["receipts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select(
          "id, receipt_no, amount, note, role_on_receipt, created_at, transaction_id, transactions(amount, note, type, created_at)",
        )
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <AppHeader
        title={t("receipts.title")}
        subtitle={t("receipts.subtitle")}
      />

      <div className="-mt-6 space-y-3 px-4 pb-6">
        {receipts.isLoading ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            {t("receipts.loading")}
          </Card>
        ) : (receipts.data ?? []).length === 0 ? (
          <Card className="shadow-card flex flex-col items-center gap-2 p-6 text-center">
            <Receipt className="size-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("receipts.empty")}</p>
          </Card>
        ) : (
          (receipts.data ?? []).map((r) => {
            const tx = r.transactions as {
              amount?: number;
              note?: string | null;
              type?: string;
            } | null;
            const isRecipient = r.role_on_receipt === "recipient";
            const typeLabel = tx?.type
              ? t(`tx.${tx.type}`) || tx.type
              : t("receipts.payment");
            return (
              <Link
                key={r.id}
                to="/receipts/$id"
                params={{ id: r.id }}
                className="block"
              >
                <Card className="shadow-card flex items-center gap-3 p-4">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                      isRecipient ? "bg-accent" : "bg-muted"
                    }`}
                  >
                    {isRecipient ? (
                      <ArrowDownLeft className="size-5 text-primary" />
                    ) : (
                      <ArrowUpRight className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.receipt_no}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {typeLabel} · {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-bold ${
                      isRecipient ? "text-success" : "text-foreground"
                    }`}
                  >
                    {isRecipient ? "+" : "−"}
                    {formatETB(r.amount).replace(" ETB", "")}
                  </p>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}