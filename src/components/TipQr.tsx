import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Copy, Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function buildPayLink({
  hotelId,
  staffId,
  origin,
}: {
  hotelId?: string | null | undefined;
  staffId?: string | null | undefined;
  origin: string;
}) {
  const params = new URLSearchParams();
  if (hotelId) params.set("hotel", hotelId);
  if (staffId) params.set("staff", staffId);
  return `${origin}/pay?${params.toString()}`;
}

export function TipQr({
  title,
  description,
  hotelId,
  staffId,
}: {
  title: string;
  description: string;
  hotelId?: string | null | undefined;
  staffId?: string | null | undefined;
}) {
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "https://elshadaybg4.lovable.app",
  );
  const link = buildPayLink({ hotelId, staffId, origin });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Payment link copied");
    } catch {
      toast.error("Could not copy the link");
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
          Copy link
        </Button>
        <Button size="sm" className="flex-1" onClick={() => void share()}>
          <Share2 className="mr-2 size-4" />
          Share
        </Button>
      </div>
    </Card>
  );
}
