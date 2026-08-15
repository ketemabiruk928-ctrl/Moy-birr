import { createServerFileRoute } from "@tanstack/react-start/server";
import { chapaVerify, isValidChapaSignature } from "@/lib/chapa.server";

// POST /api/chapa/webhook - called by Chapa's servers, not the browser.
//
// Flow: Chapa notifies us a transaction happened -> we verify the signature
// -> we independently call Chapa's own verify endpoint (never trust the
// webhook body's amount/status by itself) -> only then do we credit the
// wallet, through admin_credit_wallet() which is idempotent.
export const ServerRoute = createServerFileRoute("/api/chapa/webhook").methods({
  POST: async ({ request }) => {
    const rawBody = await request.text();

    const signature = request.headers.get("chapa-signature");
    const validSignature = await isValidChapaSignature(rawBody, signature);
    if (!validSignature) {
      console.error("[chapa webhook] invalid or missing signature");
      return new Response("invalid signature", { status: 401 });
    }

    let payload: { tx_ref?: string; reference?: string };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    // Chapa's payment webhooks use `tx_ref`; transfer webhooks use
    // `reference` - accept either so this one handler covers both deposits
    // and withdrawals.
    const txRef = payload.tx_ref ?? payload.reference;
    if (!txRef) {
      return new Response("missing tx_ref", { status: 400 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await supabaseAdmin
      .from("payment_orders")
      .select("id, amount, status, tx_ref")
      .eq("tx_ref", txRef)
      .maybeSingle();

    if (order) {
      await handleDepositWebhook(supabaseAdmin, order, txRef);
      return new Response("ok", { status: 200 });
    }

    const { data: payout } = await supabaseAdmin
      .from("payout_requests")
      .select("id, amount, status, tx_ref")
      .eq("tx_ref", txRef)
      .maybeSingle();

    if (payout) {
      await handlePayoutWebhook(supabaseAdmin, payout, txRef);
      return new Response("ok", { status: 200 });
    }

    console.error("[chapa webhook] unknown tx_ref/reference", txRef);
    // 200 so Chapa doesn't retry forever for a reference we'll never find.
    return new Response("ok", { status: 200 });
  },
});

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function handleDepositWebhook(
  supabaseAdmin: AdminClient,
  order: { id: string; amount: number; status: string },
  txRef: string,
) {
  if (order.status === "verified") return; // already credited, idempotent no-op

  // Source of truth is Chapa's verify endpoint, not the webhook payload.
  const verified = await chapaVerify(txRef);

  if (verified.status !== "success") {
    await supabaseAdmin.from("payment_orders").update({ status: "failed" }).eq("id", order.id);
    return;
  }
  if (Math.abs(verified.amount - Number(order.amount)) > 0.01) {
    console.error(
      `[chapa webhook] deposit amount mismatch for ${txRef}: order=${order.amount} chapa=${verified.amount}`,
    );
    await supabaseAdmin.from("payment_orders").update({ status: "failed" }).eq("id", order.id);
    return;
  }

  const { error: creditErr } = await supabaseAdmin.rpc("admin_credit_wallet", {
    _order_id: order.id,
    _provider_ref: verified.chapaRef,
  });
  if (creditErr) console.error("[chapa webhook] admin_credit_wallet failed", creditErr.message);
}

async function handlePayoutWebhook(
  supabaseAdmin: AdminClient,
  payout: { id: string; status: string },
  txRef: string,
) {
  if (payout.status === "completed" || payout.status === "failed") return; // already resolved

  // Chapa's transfer verify endpoint is the source of truth, same principle
  // as deposits: don't trust the webhook body alone. Transfers are checked
  // via the same /transaction/verify/{reference} pattern Chapa uses for
  // charges - confirm the exact endpoint for transfer status in your
  // dashboard/docs before relying on this in production.
  const verified = await chapaVerify(txRef);
  const success = verified.status === "success";

  const { error } = await supabaseAdmin.rpc("admin_finalize_payout", {
    _order_id: payout.id,
    _success: success,
    _provider_ref: verified.chapaRef || null,
    _failure_reason: success ? null : "Transfer failed at provider",
  });
  if (error) console.error("[chapa webhook] admin_finalize_payout failed", error.message);
}
