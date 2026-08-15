import { useRef, useState, type ComponentProps } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadMedia, useMediaUrl } from "@/lib/media";

export function MediaImg({
  src,
  ...rest
}: Omit<ComponentProps<"img">, "src"> & { src: string | null | undefined }) {
  const resolved = useMediaUrl(src);
  if (!resolved) return null;
  return <img src={resolved} loading="lazy" {...rest} />;
}

export function MediaVideo({
  src,
  ...rest
}: Omit<ComponentProps<"video">, "src"> & { src: string | null | undefined }) {
  const resolved = useMediaUrl(src);
  if (!resolved) return null;
  return <video src={resolved} controls playsInline {...rest} />;
}

export function UploadButton({
  userId,
  accept = "image/*",
  label = "Upload from phone",
  onUploaded,
}: {
  userId: string;
  accept?: string;
  label?: string;
  onUploaded: (ref: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 50 * 1024 * 1024) {
            toast.error("File is larger than 50 MB");
            return;
          }
          setBusy(true);
          try {
            const ref = await uploadMedia(file, userId);
            onUploaded(ref);
            toast.success("Uploaded");
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
        {busy ? "Uploading…" : label}
      </Button>
    </>
  );
}
