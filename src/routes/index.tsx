import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Eye,
  EyeOff,
  Gift,
  QrCode,
  Receipt,
  Send,
  Landmark,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatETB, useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Moybirr Wallet — Digital Tips for Ethiopian Hospitality" },
      {
        name: "description",
        content:
          "Your Moybirr wallet: deposit from Telebirr or your bank, send money by phone number, tip hotel staff by QR and track every transaction.",
      },
      { property: "og:title", content: "Moybirr Wallet" },
      {
        property: "og:description",
        content: "Deposit, send, withdraw and tip — the Ethiopian hospitality wallet.",
      },
    ],
  }),
  component: HomePage,
});

function errorText(json: unknown, fallback: string): string {
  if (!json || typeof json !== "object") return fallback;
  const raw = (json as { error?: unknown }).error;
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (raw && typeof raw === "object" && "message" in raw) {
    const m = (raw as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}

function HomePage() {
  return (
    <RequireAuth>
      <AppShell>
        <Wallet />
      </AppShell>
    </RequireAuth>
  );
}

function Wallet() {
  const { t } = useLang();
  const { user, profile, role } = useAuth();
  const qc = useQueryClient();
  const [hidden, setHidden] = useState(false);

  const wallet = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const txs = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["wallet"] });
    void qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  // Build transaction type labels from translations
  const typeMeta: Record<string, { label: string; icon: typeof Send; tone: string }> = {
    deposit: { label: t("tx.deposit"), icon: ArrowDownLeft, tone: "text-success" },
    withdraw: { label: t("tx.withdraw"), icon: ArrowUpRight, tone: "text-destructive" },
    transfer: { label: t("tx.transfer"), icon: Send, tone: "text-foreground" },
    tip: { label: t("tx.tip"), icon: Gift, tone: "text-primary" },
    service_payment: { label: t("tx.service_payment"), icon: QrCode, tone: "text-foreground" },
    booking: { label: t("tx.booking"), icon: Landmark, tone: "text-foreground" },
    refund: { label: t("tx.refund"), icon: ArrowDownLeft, tone: "text-success" },
    job_fee: { label: t("tx.job_fee"), icon: Banknote, tone: "text-destructive" },
    subscription: { label: t("tx.subscription"), icon: Banknote, tone: "text-destructive" },
    platform_fee: { label: t("tx.platform_fee"), icon: Banknote, tone: "text-muted-foreground" },
  };

  const roleSubtitle =
    role === "staff"
      ? t("wallet.subtitle_staff")
      : role === "owner"
        ? t("wallet.subtitle_owner")
        : t("app_tagline");

  return (
    <>
      <AppHeader
        title={`${t("wallet.hello")}, ${profile?.full_name?.split(" ")[0] || "Moybirr"}`}
        subtitle={roleSubtitle}
      />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        <Card className="shadow-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("wallet.balance")}
            </p>
            <button onClick={() => setHidden((h) => !h)} className="text-muted-foreground">
              {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            {hidden ? t("wallet.balance_hidden") : formatETB(wallet.data?.balance)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{profile?.phone}</p>

          <div className="mt-5 grid grid-cols-4 gap-2">
            <DepositDialog onDone={invalidate} />
            <SendDialog onDone={invalidate} />
            <WithdrawDialog onDone={invalidate} />
            <Link
              to="/pay"
              search={{ hotel: undefined, staff: undefined }}
              className="flex flex-col items-center gap-1.5 rounded-xl bg-muted p-3 text-xs font-medium"
            >
              <QrCode className="size-5 text-primary" />
              {t("wallet.scan_pay")}
            </Link>
          </div>
        </Card>

        {role === "staff" ? (
          <Card className="shadow-card border-primary/30 bg-accent p-4">
            <p className="text-sm font-semibold text-accent-foreground">
              {t("wallet.staff_banner_title")}
            </p>
            <p className="mt-1 text-xs text-accent-foreground/80">
              {t("wallet.staff_banner_desc")}
            </p>
            <Button asChild size="sm" variant="secondary" className="mt-3">
              <Link to="/profile">{t("wallet.update_profile")}</Link>
            </Button>
          </Card>
        ) : null}

        <Link to="/receipts" className="block">
          <Card className="shadow-card flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-semibold">{t("wallet.receipts")}</p>
              <p className="text-xs text-muted-foreground">{t("wallet.receipts_desc")}</p>
            </div>
            <Receipt className="size-5 text-primary" />
          </Card>
        </Link>

        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">{t("wallet.transactions")}</h2>
            <Badge variant="secondary">{txs.data?.length ?? 0}</Badge>
          </div>
          <Card className="shadow-card divide-y divide-border overflow-hidden p-0">
            {(txs.data ?? []).length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {t("wallet.no_transactions")}
              </p>
            ) : (
              (txs.data ?? []).map((tx) => {
                const meta = typeMeta[tx.type] ?? {
                  label: tx.type,
                  icon: Banknote,
                  tone: "text-foreground",
                };
                const Icon = meta.icon;
                const incoming = tx.receiver_id === user?.id;
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className={`size-4 ${meta.tone}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{meta.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {tx.note ?? ""} · {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-semibold ${
                        incoming ? "text-success" : "text-foreground"
                      }`}
                    >
                      {incoming ? "+" : "−"}
                      {formatETB(tx.amount).replace(" ETB", "")}
                    </p>
                  </div>
                );
              })
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function ActionTile({ icon: Icon, label }: { icon: typeof Send; label: string }) {
  return (
    <div className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl bg-muted p-3 text-xs font-medium">
      <Icon className="size-5 text-primary" />
      {label}
    </div>
  );
}

function DepositDialog({ onDone }: { onDone: () => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData.session?.access_token) {
        throw new Error(t("wallet.error_not_signed_in"));
      }

      const res = await fetch("/api/chapa/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ amount: Number(amount) }),
      });

      const json = await res.json().catch(() => ({}));
      const checkoutUrl = (json as { checkoutUrl?: string }).checkoutUrl;
      if (!res.ok || !checkoutUrl) {
        throw new Error(errorText(json, t("wallet.error_deposit_failed")));
      }
      return checkoutUrl;
    },
    onSuccess: (checkoutUrl) => {
      setOpen(false);
      window.location.href = checkoutUrl;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button>
          <ActionTile icon={ArrowDownLeft} label={t("wallet.deposit")} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("wallet.deposit")}</DialogTitle>
          <DialogDescription>{t("wallet.deposit_desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="damt">{t("wallet.amount")}</Label>
            <Input
              id="damt"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={m.isPending || !amount}
            onClick={() => m.mutate()}
          >
            {m.isPending ? t("wallet.redirecting") : t("wallet.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SendDialog({ onDone }: { onDone: () => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("wallet_transfer", {
        _recipient: recipient.trim(),
        _amount: Number(amount),
        _note: note || t("wallet.transfer_default"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("wallet.sent_success", { amount: formatETB(amount) }));
      setOpen(false);
      setAmount("");
      setRecipient("");
      setNote("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button>
          <ActionTile icon={Send} label={t("wallet.send")} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("wallet.send")}</DialogTitle>
          <DialogDescription>{t("wallet.send_desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="srecipient">{t("wallet.recipient")}</Label>
            <Input
              id="srecipient"
              inputMode="text"
              placeholder="MS-000042 or 0912 345 678"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="samt">{t("wallet.amount")}</Label>
            <Input
              id="samt"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="snote">{t("wallet.note")}</Label>
            <Input id="snote" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={m.isPending || !amount || !recipient}
            onClick={() => m.mutate()}
          >
            {t("wallet.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({ onDone }: { onDone: () => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const banksQuery = useQuery({
    queryKey: ["chapa-banks"],
    enabled: open,
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t("wallet.error_not_signed_in"));
      const res = await fetch("/api/chapa/banks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      const banks = (json as { banks?: { code: string; name: string }[] }).banks;
      if (!res.ok || !banks) {
        throw new Error(errorText(json, t("wallet.error_banks_failed")));
      }
      return banks;
    },
  });

  const m = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t("wallet.error_not_signed_in"));
      const res = await fetch("/api/chapa/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Number(amount),
          bank_code: bankCode,
          account_number: accountNumber,
          account_name: accountName,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errorText(json, t("wallet.error_withdraw_failed")));
    },
    onSuccess: () => {
      toast.success(t("wallet.withdraw_success"));
      setOpen(false);
      setAmount("");
      setAccountNumber("");
      setAccountName("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = !!amount && !!bankCode && !!accountNumber && !!accountName;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button>
          <ActionTile icon={ArrowUpRight} label={t("wallet.withdraw")} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("wallet.withdraw")}</DialogTitle>
          <DialogDescription>{t("wallet.withdraw_desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wbank">{t("wallet.bank")}</Label>
            <select
              id="wbank"
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
            >
              <option value="">
                {banksQuery.isLoading ? t("wallet.loading_banks") : t("wallet.select_bank")}
              </option>
              {banksQuery.data?.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
            {banksQuery.isError ? (
              <p className="text-xs text-destructive">
                {(banksQuery.error as Error).message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wacct">{t("wallet.account_number")}</Label>
            <Input
              id="wacct"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wname">{t("wallet.account_name")}</Label>
            <Input
              id="wname"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wamt">{t("wallet.amount")}</Label>
            <Input
              id="wamt"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={m.isPending || !canSubmit}
            onClick={() => m.mutate()}
          >
            {m.isPending ? t("wallet.sending") : t("wallet.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}