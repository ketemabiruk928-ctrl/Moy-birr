import { createFileRoute } from "@tanstack/react-router";

// GET or POST /api/notifications/dispatch
//
// The database never talks to an SMS provider directly — a payment must not
// fail because a gateway is slow. Instead, pay_service queues rows in
// public.notifications, and this endpoint drains that queue.
//
// Called by the Vercel cron entry in vercel.json every minute, and safe to
// call by hand. Two workers running at once will not send the same message
// twice: notification_claim_batch uses SKIP LOCKED.
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (required)
//   CRON_SECRET                                (required in production)
//   SMS_PROVIDER      afromessage | geezsms | log   (default: log)
//   AFROMESSAGE_TOKEN, AFROMESSAGE_SENDER, AFROMESSAGE_IDENTIFIER_ID
//   GEEZSMS_TOKEN
//   RESEND_API_KEY, NOTIFY_EMAIL_FROM         (email channel)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SMS_PROVIDER = (process.env.SMS_PROVIDER || "log").toLowerCase();
const BATCH_SIZE = Number(process.env.NOTIFY_BATCH_SIZE || 25);

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: String(SERVICE_KEY),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args ?? {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn} failed (${res.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

// Ethiopian numbers are typed as 09xxxxxxxx locally but every gateway wants
// E.164, so normalise before handing the number over.
function toE164(raw: string): string {
  const digits = String(raw || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("251")) return `+${digits}`;
  if (digits.startsWith("0")) return `+251${digits.slice(1)}`;
  if (digits.length === 9) return `+251${digits}`;
  return `+${digits}`;
}

async function sendSms(to: string, body: string): Promise<string | null> {
  const phone = toE164(to);

  if (SMS_PROVIDER === "afromessage") {
    const res = await fetch("https://api.afromessage.com/api/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AFROMESSAGE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: phone,
        message: body,
        from: process.env.AFROMESSAGE_IDENTIFIER_ID || undefined,
        sender: process.env.AFROMESSAGE_SENDER || undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      acknowledge?: string;
      response?: { errors?: string[]; message_id?: string };
    };
    if (!res.ok || json.acknowledge !== "success") {
      throw new Error(
        json.response?.errors?.join?.("; ") ||
          `AfroMessage rejected the message (${res.status})`,
      );
    }
    return json.response?.message_id ?? null;
  }

  if (SMS_PROVIDER === "geezsms") {
    const res = await fetch("https://api.geezsms.com/api/v1/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: process.env.GEEZSMS_TOKEN, phone, msg: body }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: unknown;
      msg?: string;
      data?: { id?: string };
    };
    if (!res.ok || json.error) {
      throw new Error(json.msg || `GeezSMS rejected the message (${res.status})`);
    }
    return json.data?.id ?? null;
  }

  // "log" provider: used before an SMS contract is signed. The message is
  // marked sent so the queue keeps moving, and the body is printed so it
  // can be checked in the Vercel logs.
  console.log(`[sms:log] ${phone} :: ${body}`);
  return "log";
}

async function sendEmail(
  to: string,
  subject: string | null,
  body: string,
): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:log] ${to} :: ${subject} :: ${body}`);
    return "log";
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.NOTIFY_EMAIL_FROM || "Moybirr <noreply@moybirr.com>",
      to: [to],
      subject: subject || "Moybirr",
      html: body,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(json.message || `Email provider rejected (${res.status})`);
  return json.id ?? null;
}

type Claimed = {
  id: string;
  channel: "sms" | "email";
  destination: string;
  subject: string | null;
  body: string;
  template: string;
};

async function runDispatch(): Promise<Response> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return Response.json({ ok: false, error: "Server not configured" }, { status: 500 });
  }

  let claimed: Claimed[];
  try {
    const result = await rpc("notification_claim_batch", { _limit: BATCH_SIZE });
    claimed = Array.isArray(result) ? (result as Claimed[]) : [];
  } catch (e) {
    return Response.json(
      { ok: false, error: String((e as Error).message ?? e) },
      { status: 500 },
    );
  }

  let sent = 0;
  let failed = 0;

  // Sequential on purpose: SMS gateways rate-limit hard.
  for (const row of claimed) {
    try {
      const id =
        row.channel === "email"
          ? await sendEmail(row.destination, row.subject, row.body)
          : await sendSms(row.destination, row.body);
      await rpc("notification_mark_sent", { _id: row.id, _provider_message_id: id });
      sent += 1;
    } catch (e) {
      await rpc("notification_mark_failed", {
        _id: row.id,
        _error: String((e as Error).message ?? e).slice(0, 500),
      });
      failed += 1;
    }
  }

  return Response.json({ ok: true, claimed: claimed.length, sent, failed });
}

export const Route = createFileRoute("/api/notifications/dispatch")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Vercel cron sends Authorization: Bearer <CRON_SECRET>.
        // A public request must not drain the queue and burn SMS credit.
        const secret = process.env.CRON_SECRET;
        if (secret) {
          const auth = request.headers.get("authorization") || "";
          const url = new URL(request.url);
          const provided =
            auth.replace(/^Bearer\s+/i, "") || url.searchParams.get("key");
          if (provided !== secret) {
            return new Response("Unauthorized", { status: 401 });
          }
        }
        return runDispatch();
      },
      POST: async () => runDispatch(),
    },
  },
});