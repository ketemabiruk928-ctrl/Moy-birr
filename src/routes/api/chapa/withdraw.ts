import { createServerFileRoute, getRequest } from "@tanstack/react-start/server";
import { chapaTransferToBank } from "@/lib/chapa.server";

// POST /api/chapa/withdraw  { amount, bank_code, account_number, account_name }
//
// 1. Verify who's asking (their own bearer token - never a client-sent id).
// 2. Reserve the funds immediately via request_withdrawal() so the balance
//    can't be spent twice while the transfer is in flight.
// 3. Ask Chapa to send the money. If Chapa rejects it outright, refund
//    instantly. If Chapa accepts it, the final success/failure comes later
//    via the webhook - the payout sits as "processing" until then.
export const ServerRoute = createServerFileRoute("/api/chapa/withdraw").methods({
  POST: async () => {
    const request = getRequest();
    const authHeader = request.headers.get("authorization");
    if (!authHeader) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = userData.user;

    let body: { amount?: number; bank_code?: string; account_number?: string; account_name?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const amount = Number(body.amount);
    const bankCode = (body.bank_code ?? "").trim();
    const accountNumber = (body.account_number ?? "").trim();
    const accountName = (body.account_name ?? "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "Amount must be a positive number" }, { status: 400 });
    }
    if (!bankCode || !accountNumber || !accountName) {
      return Response.json({ error: "Bank, account number, and account name are required" }, { status: 400 });
    }

    const { data: reserved, error: reserveErr } = await supabaseAdmin.rpc("request_withdrawal", {
      _user_id: user.id,
      _amount: amount,
      _bank_code: bankCode,
      _account_number: accountNumber,
      _account_name: accountName,
    });

    if (reserveErr || !reserved || !reserved[0]) {
      return Response.json({ error: reserveErr?.message ?? "Could not reserve funds" }, { status: 400 });
    }
    const { order_id, tx_ref } = reserved[0];

    const result = await chapaTransferToBank({
      account_name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      amount,
      reference: tx_ref,
    });

    if (result.status === "failed") {
      await supabaseAdmin.rpc("admin_finalize_payout", {
        _order_id: order_id,
        _success: false,
        _provider_ref: null,
        _failure_reason: result.message,
      });
      return Response.json({ error: result.message }, { status: 502 });
    }

    // Accepted for processing - mark it so and wait for the webhook to
    // confirm the final outcome.
    await supabaseAdmin.from("payout_requests").update({ status: "processing" }).eq("id", order_id);

    return Response.json({ orderId: order_id, status: "processing" });
  },
});
