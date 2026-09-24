import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";

type Message = {
  id: string;
  sender_id: string;
  sender_name: string | null;
  content: string;
  created_at: string;
};

export function TeamChat({ hotelId }: { hotelId: string }) {
  const { t } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const messages = useQuery({
    queryKey: ["team-chat", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_messages")
        .select("id,sender_id,sender_name,content,created_at")
        .eq("hotel_id", hotelId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_messages").insert({
        hotel_id: hotelId,
        sender_id: user!.id,
        content: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      void qc.invalidateQueries({ queryKey: ["team-chat", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = messages.data ?? [];

  return (
    <div className="space-y-3">
      <Card className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <p className="text-sm font-semibold">{t("team_chat.title")}</p>
        </div>
        <Badge variant="secondary">
          {rows.length} {t("team_chat.messages_count")}
        </Badge>
      </Card>

      {messages.isLoading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {t("team_chat.loading")}
        </Card>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-6 text-center">
          <MessageSquare className="size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("team_chat.empty")}</p>
          <p className="text-xs text-muted-foreground">
            {t("team_chat.empty_hint")}
          </p>
        </Card>
      ) : (
        <Card className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
          {rows.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    mine ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {!mine && m.sender_name ? (
                    <p className="text-[10px] font-semibold opacity-80">
                      {m.sender_name}
                    </p>
                  ) : null}
                  <p className="text-sm">{m.content}</p>
                  <p
                    className={`mt-0.5 text-[10px] ${
                      mine ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("team_chat.placeholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && text.trim()) {
              e.preventDefault();
              send.mutate();
            }
          }}
        />
        <Button
          disabled={!text.trim() || send.isPending}
          onClick={() => send.mutate()}
          className="gap-2"
        >
          <Send className="size-4" />
          {t("team_chat.send")}
        </Button>
      </div>
    </div>
  );
}