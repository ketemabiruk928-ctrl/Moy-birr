import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, Send, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Channel = {
  id: string;
  name: string;
  kind: string;
  last_message_at: string | null;
  unread: number;
};

type Message = {
  id: string;
  sender_id: string | null;
  sender_name: string | null;
  sender_role: string | null;
  body: string;
  is_report: boolean;
  attachment_url: string | null;
  created_at: string;
  edited_at: string | null;
};

export function TeamChat({ hotelId }: { hotelId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [asReport, setAsReport] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const channels = useQuery({
    queryKey: ["team-channels", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("team_channels_list", {
        _hotel_id: hotelId,
      });
      if (error) throw error;
      return (data ?? []) as Channel[];
    },
  });

  // Pick the first channel once they load.
  useEffect(() => {
    if (!activeId && (channels.data ?? []).length > 0) {
      setActiveId(channels.data![0].id);
    }
  }, [channels.data, activeId]);

  const messages = useQuery({
    queryKey: ["team-messages", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("team_messages_list", {
        _channel_id: activeId!,
        _limit: 100,
      });
      if (error) throw error;
      return ((data ?? []) as Message[]).slice().reverse(); // oldest first
    },
  });

  // Realtime — new messages appear without a refresh.
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`team:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_messages",
          filter: `channel_id=eq.${activeId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["team-messages", activeId] });
          void qc.invalidateQueries({ queryKey: ["team-channels", hotelId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, hotelId, qc]);

  // Mark read when opening a channel.
  useEffect(() => {
    if (!activeId) return;
    void supabase.rpc("mark_channel_read", { _channel_id: activeId }).then(() => {
      void qc.invalidateQueries({ queryKey: ["team-channels", hotelId] });
    });
  }, [activeId, hotelId, qc]);

  // Scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.data]);

  const post = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("post_team_message", {
        _channel_id: activeId!,
        _body: draft.trim(),
        _is_report: asReport,
        _attachment_url: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      setAsReport(false);
      void qc.invalidateQueries({ queryKey: ["team-messages", activeId] });
      void qc.invalidateQueries({ queryKey: ["team-channels", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_team_message", { _message_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["team-messages", activeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeChannel = useMemo(
    () => (channels.data ?? []).find((c) => c.id === activeId) ?? null,
    [channels.data, activeId],
  );
  const isReportsChannel = activeChannel?.kind === "reports";

  return (
    <div className="space-y-3">
      {/* Channel picker */}
      <div className="flex flex-wrap gap-2">
        {(channels.data ?? []).map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveId(c.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              activeId === c.id ? "border-primary bg-accent" : "border-border"
            }`}
          >
            <Hash className="size-3.5" />
            {c.name}
            {c.unread > 0 ? (
              <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                {c.unread}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Messages */}
      <Card className="flex h-[420px] flex-col overflow-hidden p-0">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.isLoading ? (
            <p className="text-center text-sm text-muted-foreground">Loading messages…</p>
          ) : (messages.data ?? []).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No messages yet. Say hello.
            </p>
          ) : (
            (messages.data ?? []).map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                      mine ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {!mine ? (
                      <p className="mb-0.5 text-[11px] font-semibold opacity-70">
                        {m.sender_name || "Staff"} · {m.sender_role}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                    <div className="mt-1 flex items-center gap-2">
                      {m.is_report ? (
                        <Badge variant="secondary" className="text-[10px]">
                          <AlertTriangle className="mr-1 size-3" />
                          shift report
                        </Badge>
                      ) : null}
                      <span className="text-[10px] opacity-60">
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {mine ? (
                        <button
                          onClick={() => remove.mutate(m.id)}
                          className="opacity-60 hover:opacity-100"
                          aria-label="Delete message"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          {isReportsChannel ? (
            <p className="mb-2 text-[11px] text-muted-foreground">
              This channel is for shift reports. The owner is notified by SMS.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message your team…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && draft.trim()) {
                  e.preventDefault();
                  post.mutate();
                }
              }}
            />
            <Button
              disabled={!draft.trim() || post.isPending || !activeId}
              onClick={() => post.mutate()}
              size="icon"
            >
              <Send className="size-4" />
            </Button>
          </div>
          {!isReportsChannel ? (
            <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={asReport}
                onChange={(e) => setAsReport(e.target.checked)}
              />
              Send as shift report (SMS to owner)
            </label>
          ) : null}
        </div>
      </Card>
    </div>
  );
}