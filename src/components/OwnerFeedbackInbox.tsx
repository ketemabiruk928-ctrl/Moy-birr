import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Reply, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type FeedbackRow = {
  id: string;
  guest_name: string | null;
  guest_phone: string | null;
  staff_profile_id: string | null;
  staff_name: string | null;
  message: string;
  status: "new" | "read" | "resolved";
  owner_reply: string | null;
  owner_replied_at: string | null;
  created_at: string;
};

export function OwnerFeedbackInbox({ hotelId }: { hotelId: string }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "read" | "resolved">("all");

  const feedback = useQuery({
    queryKey: ["owner-feedback", hotelId, filter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_feedback_list", {
        _hotel_id: hotelId,
        _status: filter === "all" ? null : filter,
      });
      if (error) throw error;
      return (data ?? []) as FeedbackRow[];
    },
  });

  const sendReply = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("reply_to_feedback", {
        _feedback_id: id,
        _reply: reply.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("feedback.reply_sent"));
      setReplyTo(null);
      setReply("");
      void qc.invalidateQueries({ queryKey: ["owner-feedback", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (vars: { id: string; status: "read" | "resolved" }) => {
      const { error } = await supabase.rpc("set_feedback_status", {
        _feedback_id: vars.id,
        _status: vars.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["owner-feedback", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = feedback.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["all", "new", "read", "resolved"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {t(`feedback.filter_${f}`)}
          </Button>
        ))}
      </div>

      {feedback.isLoading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {t("feedback.loading")}
        </Card>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-6 text-center">
          <MessageSquare className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("feedback.empty")}</p>
        </Card>
      ) : (
        rows.map((f) => (
          <Card key={f.id} className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {f.guest_name || t("feedback.guest")}
                  {f.guest_phone ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {f.guest_phone}
                    </span>
                  ) : null}
                </p>
                {f.staff_name ? (
                  <p className="text-xs text-muted-foreground">
                    {t("feedback.about")}: {f.staff_name}
                  </p>
                ) : null}
              </div>
              <Badge
                variant={
                  f.status === "new"
                    ? "default"
                    : f.status === "resolved"
                      ? "secondary"
                      : "outline"
                }
              >
                {t(`feedback.status_${f.status}`)}
              </Badge>
            </div>

            <p className="whitespace-pre-wrap text-sm text-foreground">{f.message}</p>

            {f.owner_reply ? (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("feedback.your_reply")}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{f.owner_reply}</p>
              </div>
            ) : null}

            <p className="text-[11px] text-muted-foreground">
              {new Date(f.created_at).toLocaleString()}
            </p>

            {replyTo === f.id ? (
              <div className="space-y-2 border-t border-border pt-3">
                <Textarea
                  autoFocus
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={t("feedback.reply_placeholder")}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={reply.trim().length < 2 || sendReply.isPending}
                    onClick={() => sendReply.mutate(f.id)}
                  >
                    {t("feedback.send_reply")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setReplyTo(null);
                      setReply("");
                    }}
                  >
                    {t("wallet.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 border-t border-border pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReplyTo(f.id);
                    setReply(f.owner_reply ?? "");
                  }}
                >
                  <Reply className="mr-1 size-3.5" />
                  {f.owner_reply ? t("feedback.edit_reply") : t("feedback.reply")}
                </Button>
                {f.status !== "resolved" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: f.id, status: "resolved" })}
                  >
                    <CheckCircle2 className="mr-1 size-3.5" />
                    {t("feedback.mark_resolved")}
                  </Button>
                ) : null}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}