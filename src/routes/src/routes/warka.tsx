import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { AppHeader, AppShell, RequireAuth } from "@/components/AppShell";
import { MediaImg, MediaVideo } from "@/components/Media";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/warka")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <WarkaPage />
      </AppShell>
    </RequireAuth>
  ),
});

function WarkaPage() {
  const { t } = useLang();

  const posts = useQuery({
    queryKey: ["warka-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_media")
        .select(
          "id, kind, url, caption, created_at, hotels:hotel_id(id, name, city, photo_url)",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      <AppHeader title={t("warka")} subtitle="Photos & videos from hotels" />

      <div className="-mt-6 space-y-4 px-4 pb-6">
        {posts.isLoading ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            Loading Warka…
          </Card>
        ) : (posts.data ?? []).length === 0 ? (
          <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
            No hotel posts yet. When hotel owners upload photos or videos, they will appear here.
          </Card>
        ) : (
          (posts.data ?? []).map((post) => {
            const hotel = post.hotels as
              | { id?: string; name?: string; city?: string; photo_url?: string | null }
              | null;

            return (
              <Card key={post.id} className="shadow-card overflow-hidden p-0">
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {hotel?.name || "Hotel"}
                    </p>
                    {hotel?.city ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" />
                        {hotel.city}
                      </p>
                    ) : null}
                  </div>
                </div>

                {post.kind === "video" ? (
                  <MediaVideo
                    src={post.url}
                    className="aspect-[9/16] max-h-[70vh] w-full bg-black object-contain"
                  />
                ) : (
                  <MediaImg
                    src={post.url}
                    alt={post.caption || hotel?.name || "Hotel post"}
                    className="aspect-[9/16] max-h-[70vh] w-full bg-muted object-cover"
                  />
                )}

                {post.caption ? (
                  <p className="px-3 py-2 text-sm text-foreground">{post.caption}</p>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
