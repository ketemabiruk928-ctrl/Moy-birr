import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "hotel-media";
const PREFIX = "sb://";

/** Uploads a file to the owner's own folder and returns a portable storage reference. */
export async function uploadMedia(file: File, userId: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    ...(file.type ? { contentType: file.type } : {}),
  });
  if (error) throw error;
  return `${PREFIX}${path}`;
}

export function isStorageRef(url: string | null | undefined) {
  return !!url && url.startsWith(PREFIX);
}

const cache = new Map<string, string>();

export async function resolveMediaUrl(url: string) {
  if (!isStorageRef(url)) return url;
  const cached = cache.get(url);
  if (cached) return cached;
  const path = url.slice(PREFIX.length);
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return "";
  cache.set(url, data.signedUrl);
  return data.signedUrl;
}

/** Resolves storage references to a temporary signed URL; plain URLs pass through. */
export function useMediaUrl(url: string | null | undefined) {
  const [src, setSrc] = useState(() => (isStorageRef(url) ? (cache.get(url!) ?? "") : (url ?? "")));

  useEffect(() => {
    if (!url) {
      setSrc("");
      return;
    }
    if (!isStorageRef(url)) {
      setSrc(url);
      return;
    }
    let alive = true;
    void resolveMediaUrl(url).then((r) => {
      if (alive) setSrc(r);
    });
    return () => {
      alive = false;
    };
  }, [url]);

  return src;
}
