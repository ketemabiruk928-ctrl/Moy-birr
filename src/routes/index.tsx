import { createFileRoute } from "@tanstack/react-router";
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
import { Link } from "@tanstack/react-router";

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

const typeMeta: Record<string, { label: string; icon: typeof Send; tone: string }> = {
  deposit: { label: "Deposit", icon: ArrowDownLeft, tone: "text-success" },
  withdraw: { label: "Withdraw", icon: ArrowUpRight, tone: "text-destructive" },
  transfer: { label: "Transfer", icon: Send, tone: "text-foreground" },
  tip: { label: "Tip", icon: Gift, tone: "text-primary" },
  service_payment: { label: "Service payment", icon: QrCode, tone: "text-foreground" },
  booking: { label: "Hotel booking", icon: Landmark, tone: "text-foreground" },
  refund: { label: "Refund", icon: ArrowDownLeft, tone: "text-success" },
  job_fee: { label: "Job posting fee", icon: Banknote, tone: "text-destructive" },
  subscription: { label: "Premium subscription", icon: Banknote, tone: "text-destructive" },
};

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

  return (
    <>
      <AppHeader
        title={`ሰላም, ${profile?.full_name?.split(" ")[0] || "Moybirr"}`}
        subtitle={role === "staff" ? "Staff account" : role === "owner" ? "Hotel owner" : t("app_tagline")}
      />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        <Card className="shadow-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("balance")}
            </p>
            <button onClick={() => setHidden((h) => !h)} className="text-muted-foreground">
              {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            {hidden ? "•••••• ETB" : formatETB(wallet.data?.balance)}
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
              {t("scan_pay")}
            </Link>
          </div>
        </Card>

        {role === "staff" ? (
          <Card className="shadow-card border-primary/30 bg-accent p-4">
            <p className="text-sm font-semibold text-accent-foreground">
              Tips arrive here instantly 🎉
            </p>
            <p className="mt-1 text-xs text-accent-foreground/80">
              Keep your profile and GPS location updated so guests can find and tip you.
            </p>
            <Button asChild size="sm" variant="secondary" className="mt-3">
              <Link to="/profile">Update my staff profile</Link>
            </Button>
          </Card>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">{t("transactions")}</h2>
            <Badge variant="secondary">{txs.data?.length ?? 0}</Badge>
          </div>
          <Card className="shadow-card divide-y divide-border overflow-hidden p-0">
            {(txs.data ?? []).length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t("no_transactions")}</p>
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
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  // Deposits no longer credit the wallet directly from the client - that was
  // a self-serve "add free money" hole. This kicks off a real Chapa
  // checkout; the wallet only gets credited after Chapa confirms payment via
  // the server-side webhook (see /api/chapa/webhook).
  const m = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Not signed in");
      const res = await fetch("/api/chapa/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const json = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !json.checkoutUrl) throw new Error(json.error ?? "Could not start deposit");
      return json.checkoutUrl;
    },
    onSuccess: (checkoutUrl) => {
      setOpen(false);
      // Hand off to Chapa's hosted checkout (Telebirr, CBE, cards, etc. all
      // live there) - we never collect card/PIN details ourselves.
      window.location.href = checkoutUrl;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button>
          <ActionTile icon={ArrowDownLeft} label={t("deposit")} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deposit")}</DialogTitle>
          <DialogDescription>
            You'll pick Telebirr, your bank, or a card on the next screen and confirm the payment there.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="damt">{t("amount")}</Label>
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
            {m.isPending ? "Redirecting..." : t("confirm")}
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
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      const digits = phone.replace(/\D/g, "");
      const normalized = digits.startsWith("251")
        ? `+${digits}`
        : `+251${digits.replace(/^0/, "")}`;
      const { error } = await supabase.rpc("wallet_transfer", {
        _phone: normalized,
        _amount: Number(amount),
        _note: note || "Transfer",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Sent ${formatETB(amount)} · SMS notification sent`);
      setOpen(false);
      setAmount("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button>
          <ActionTile icon={Send} label={t("send")} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("send")}</DialogTitle>
          <DialogDescription>Send money to any Moybirr user by phone number.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sphone">{t("phone")}</Label>
            <Input
              id="sphone"
              inputMode="tel"
              placeholder="09xx xxx xxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="samt">{t("amount")}</Label>
            <Input
              id="samt"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="snote">Note</Label>
            <Input id="snote" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={m.isPending || !amount || !phone}
            onClick={() => m.mutate()}
          >
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({ onDone }: { onDone: () => void }) {
  const { t } = useLang();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const banksQuery = useQuery({
    queryKey: ["chapa-banks"],
    enabled: open && !!session,
    queryFn: async () => {
      const res = await fetch("/api/chapa/banks", {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      const json = (await res.json()) as { banks?: { code: string; name: string }[]; error?: string };
      if (!res.ok || !json.banks) throw new Error(json.error ?? "Could not load banks");
      return json.banks;
    },
  });

  // Withdrawals now reserve the money and send a real transfer request to
  // Chapa instead of just decrementing a number and hoping. If the transfer
  // fails, the webhook refunds the wallet automatically.
  const m = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Not signed in");
      const res = await fetch("/api/chapa/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          amount: Number(amount),
          bank_code: bankCode,
          account_number: accountNumber,
          account_name: accountName,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Withdrawal failed");
    },
    onSuccess: () => {
      toast.success("Withdrawal sent — it'll land in a few minutes");
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
          <ActionTile icon={ArrowUpRight} label={t("withdraw")} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("withdraw")}</DialogTitle>
          <DialogDescription>
            Sent as a real bank transfer. Double-check the account details — we can't reverse a transfer sent to the wrong account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wbank">Bank</Label>
            <select
              id="wbank"
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
            >
              <option value="">
                {banksQuery.isLoading ? "Loading banks..." : "Select a bank"}
              </option>
              {banksQuery.data?.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wacct">Account number</Label>
            <Input
              id="wacct"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wname">Account holder name</Label>
            <Input
              id="wname"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wamt">{t("amount")}</Label>
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
            {m.isPending ? "Sending..." : t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
