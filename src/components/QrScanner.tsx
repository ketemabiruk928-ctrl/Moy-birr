import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLang } from "@/lib/i18n";

/** Camera QR scanner. The engine is imported lazily so SSR never touches it. */
export function QrScanButton({
  onResult,
  label,
}: {
  onResult: (text: string) => void;
  label?: string;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const displayLabel = label ?? t("qr_scanner.scan_button");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full">
          <ScanLine className="mr-2 size-5" />
          {displayLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("qr_scanner.title")}</DialogTitle>
          <DialogDescription>{t("qr_scanner.desc")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <ScannerView
            onResult={(text) => {
              setOpen(false);
              onResult(text);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ScannerView({ onResult }: { onResult: (text: string) => void }) {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let scanner: { stop: () => void; destroy: () => void } | null = null;

    void (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (stopped || !videoRef.current) return;
        const instance = new QrScanner(
          videoRef.current,
          (res: { data: string }) => {
            if (res.data) onResult(res.data);
          },
          { highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5 },
        );
        scanner = instance;
        await instance.start();
        if (stopped) instance.stop();
      } catch {
        setError(t("qr_scanner.camera_unavailable"));
      }
    })();

    return () => {
      stopped = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [onResult, t]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-muted p-6 text-center">
        <CameraOff className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-muted">
      <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
      <p className="flex items-center justify-center gap-1.5 p-2 text-xs text-muted-foreground">
        <Camera className="size-3.5" />
        {t("qr_scanner.looking")}
      </p>
    </div>
  );
}