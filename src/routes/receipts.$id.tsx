import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Share2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatETB, useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/receipts/$id")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <ReceiptDetailPage />
      </AppShell>
    </RequireAuth>
  ),
});

function ReceiptDetailPage() {
  const { t } = useLang();
  const { id } = useParams({ from: "/receipts/$id" });
  const { user } = useAuth();

  const receipt = useQuery({
    queryKey: ["receipt", id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select(
          "id, receipt_no, amount, note, role_on_receipt, created_at, owner_id, transaction_id, transactions(amount, note, type, created_at, hotel_id, sender_id, receiver_id, group_id, hotels(name, city))",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const r = receipt.data;
  const tx = r?.transactions as
    | {
        amount: number;
        note: string | null;
        type: string;
        created_at: string;
        hotel_id: string | null;
        hotels?: { name?: string; city?: string } | null;
      }
    | null;

  const printReceipt = () => {
    window.print();
  };

  const shareReceipt = async () => {
    if (!r) return;
    const url = `${window.location.origin}/receipts/${r.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${t("receipt_detail.share_title")} ${r.receipt_no}`,
          text: t("receipt_detail.share_text", { amount: formatETB(r.amount) }),
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(t("receipt_detail.link_copied"));
      }
    } catch {
      // user cancelled — ignore
    }
  };

  const typeLabel = tx?.type ? t(`tx.${tx.type}`) || tx.type : t("receipts.payment");

  return (
    <>
      <AppHeader
        title={t("receipt_detail.title")}
        subtitle={r?.receipt_no ?? t("loading")}
      />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        <Link
          to="/receipts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> {t("receipt_detail.all_receipts")}
        </Link>

        {receipt.isLoading ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            {t("loading")}
          </Card>
        ) : !r ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            {t("receipt_detail.not_found")}
          </Card>
        ) : (
          <>
            {/* The receipt itself — this is what prints / saves as PDF */}
            <Card className="shadow-card p-6 print:shadow-none" id="receipt-print">
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Moybirr
                </p>
                <p className="mt-1 text-lg font-bold">
                  {t("receipt_detail.payment_receipt")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.receipt_no}</p>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <Row label={t("receipt_detail.date")}>
                  {new Date(r.created_at).toLocaleString()}
                </Row>
                <Row label={t("receipt_detail.type")}>
                  <span className="capitalize">{typeLabel}</span>
                </Row>
                {tx?.hotels?.name ? (
                  <Row label={t("receipt_detail.location")}>
                    {tx.hotels.name}
                    {tx.hotels.city ? ` · ${tx.hotels.city}` : ""}
                  </Row>
                ) : null}
                <Row label={t("receipt_detail.your_role")}>
                  <span className="capitalize">{r.role_on_receipt}</span>
                </Row>
                {r.note ? (
                  <Row label={t("receipt_detail.note")}>{r.note}</Row>
                ) : null}
              </div>

              <div className="mt-6 border-t border-border pt-4">
                <Row label={t("receipt_detail.amount")} bold>
                  {formatETB(r.amount)}
                </Row>
              </div>

              <p className="mt-8 text-center text-[10px] text-muted-foreground">
                {t("receipt_detail.footer")}
              </p>
            </Card>

            {/* Action buttons — hidden when printing */}
            <div className="grid grid-cols-2 gap-2 print:hidden">
              <Button variant="outline" onClick={printReceipt}>
                <Download className="mr-2 size-4" />
                {t("receipt_detail.save_print")}
              </Button>
              <Button variant="outline" onClick={shareReceipt}>
                <Share2 className="mr-2 size-4" />
                {t("receipt_detail.share")}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Row({
  label,
  children,
  bold = false,
}: {
  label: string;
  children: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "text-base font-bold" : "text-right"}>
        {children}
      </span>
    </div>
  );
}