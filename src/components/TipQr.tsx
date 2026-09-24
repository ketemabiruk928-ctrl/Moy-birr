import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Copy, Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

/**
 * Build the URL encoded in a QR code.
 *
 * All QRs point at /c/<code>, where <code> is the Moybirr ID:
 *   guest  → MG-000123
 *   owner  → MO-000045
 *   staff  → MS-000042
 *   hotel  → MH-000001
 *
 * The /c/$code page shows only safe info per role. Never phone numbers,
 * GPS, or wallet data.
 */
export function buildPayLink({
  hotelCode,
  staffCode,
  origin,
}: {
  hotelCode?: string | null | undefined;
  staffCode?: string | null | undefined;
  origin: string;
}) {
  if (staffCode) return `${origin}/c/${staffCode}`;
  if (hotelCode) return `${origin}/c/${hotelCode}`;
  return `${origin}/`;
}

export function TipQr({
  title,
  description,
  hotelCode,
  staffCode,
}: {
  title: string;
  description: string;
  hotelCode?: string | null | undefined;
  staffCode?: string | null | undefined;
}) {
  const { t } = useLang();
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "https://moy-birr.vercel.app",
  );
  const link = buildPayLink({ hotelCode, staffCode, origin });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("tip_qr.copied"));
    } catch {
      toast.error(t("tip_qr.copy_failed"));
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: link });
      } catch {
        /* dismissed */
      }
      return;
    }
    void copy();
  };

  return (
    <Card className="shadow-card space-y-3 p-5 text-center">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="mx-auto w-fit rounded-2xl bg-card p-3 ring-1 ring-border">
        <QRCodeSVG value={link} size={168} level="M" marginSize={1} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => void copy()}>
          <Copy className="mr-2 size-4" />
          {t("tip_qr.copy_link")}
        </Button>
        <Button size="sm" className="flex-1" onClick={() => void share()}>
          <Share2 className="mr-2 size-4" />
          {t("tip_qr.share")}
        </Button>
      </div>
    </Card>
  );
}