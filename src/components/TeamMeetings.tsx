import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Video } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Meeting = {
  id: string;
  title: string;
  agenda: string | null;
  provider: string;
  join_url: string;
  starts_at: string;
  duration_min: number;
  status: string;
  created_by_name: string | null;
};

const PROVIDERS = [
  { key: "jitsi", label: "Moybirr video", hint: "A private room is created for you" },
  { key: "zoom", label: "Zoom", hint: "Paste your own meeting link" },
  { key: "daily", label: "Daily", hint: "Paste your own meeting link" },
];

function whenLabel(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TeamMeetings({
  hotelId,
  canSchedule,
}: {
  hotelId: string;
  canSchedule: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState("30");
  const [provider, setProvider] = useState("jitsi");
  const [link, setLink] = useState("");

  const meetings = useQuery({
    queryKey: ["team-meetings", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("meetings_list", {
        _hotel_id: hotelId,
        _include_past: false,
      });
      if (error) throw error;
      return (data ?? []) as Meeting[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("schedule_meeting", {
        _hotel_id: hotelId,
        _title: title.trim(),
        _starts_at: new Date(startsAt).toISOString(),
        _duration_min: Number(duration) || 30,
        _agenda: agenda.trim() || null,
        _provider: provider,
        _join_url: provider === "jitsi" ? null : link.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meeting set — your team has been texted");
      setOpen(false);
      setTitle("");
      setAgenda("");
      setStartsAt("");
      setLink("");
      void qc.invalidateQueries({ queryKey: ["team-meetings", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_meeting", { _meeting_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meeting cancelled");
      void qc.invalidateQueries({ queryKey: ["team-meetings", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = meetings.data ?? [];

  return (
    <div className="space-y-3">
      {canSchedule ? (
        open ? (
          <Card className="space-y-3 p-4">
            <p className="text-sm font-semibold">New meeting</p>

            <div className="space-y-1.5">
              <Label htmlFor="mt">Title</Label>
              <Input
                id="mt"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Monday briefing"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ms">Starts</Label>
                <Input
                  id="ms"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="md">Minutes</Label>
                <Input
                  id="md"
                  type="number"
                  min={5}
                  max={480}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Where</Label>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((p) => (
                  <Button
                    key={p.key}
                    type="button"
                    size="sm"
                    variant={provider === p.key ? "default" : "outline"}
                    onClick={() => setProvider(p.key)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {PROVIDERS.find((p) => p.key === provider)?.hint}
              </p>
            </div>

            {provider !== "jitsi" ? (
              <div className="space-y-1.5">
                <Label htmlFor="ml">Meeting link</Label>
                <Input
                  id="ml"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://zoom.us/j/…"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="ma">Agenda (optional)</Label>
              <Textarea
                id="ma"
                rows={2}
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                placeholder="Stock, rota, complaints from last week"
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={create.isPending || title.trim().length < 2 || !startsAt}
                onClick={() => create.mutate()}
              >
                Schedule and invite the team
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        ) : (
          <Button onClick={() => setOpen(true)} className="gap-2">
            <CalendarClock className="size-4" />
            Call a meeting
          </Button>
        )
      ) : null}

      {meetings.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading meetings…</p>
      ) : null}

      {!meetings.isLoading && rows.length === 0 ? (
        <Card className="p-6 text-center">
          <Video className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No meetings coming up.</p>
        </Card>
      ) : null}

      {rows.map((m) => {
        const soon = new Date(m.starts_at).getTime() - Date.now() < 15 * 60 * 1000;
        const cancelled = m.status === "cancelled";
        return (
          <Card key={m.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{m.title}</p>
              {cancelled ? <Badge variant="destructive">cancelled</Badge> : null}
              {!cancelled && soon ? <Badge>starting soon</Badge> : null}
              <span className="ml-auto text-xs text-muted-foreground">
                {whenLabel(m.starts_at)} · {m.duration_min} min
              </span>
            </div>

            {m.agenda ? <p className="text-sm text-muted-foreground">{m.agenda}</p> : null}
            <p className="text-xs text-muted-foreground">
              Called by {m.created_by_name || "management"}
            </p>

            {!cancelled ? (
              <div className="flex gap-2">
                <Button asChild className="flex-1 gap-2">
                  <a href={m.join_url} target="_blank" rel="noreferrer">
                    <Video className="size-4" />
                    Join
                  </a>
                </Button>
                {canSchedule ? (
                  <Button variant="outline" onClick={() => cancel.mutate(m.id)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}