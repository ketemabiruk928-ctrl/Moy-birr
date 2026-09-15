import { createServerFileRoute } from "@tanstack/react-start/server";
import { getRequest } from "@tanstack/react-start/server";
import { chapaInitialize } from "@/lib/chapa.server";

// POST /api/chapa/initiate  { amount: number }
// Creates a pending payment_orders row for the logged-in user, then asks
// Chapa for a checkout URL. The wallet balance is NOT touched here - only
// the webhook (after Chapa confirms payment) can do that.
export const ServerRoute = createServerFileRoute("/api/chapa/initiate").methods({
  POST: async () => {
    const request = getRequest();

    // Verify the caller with their own bearer token so we know which user
    // this deposit belongs to - never trust a user_id sent in the body.
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = userData.user;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_blocked, country_code")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.is_blocked) {
      return Response.json(
        { error: "This account has been blocked. Contact support." },
        { status: 403 },
      );
    }

    const { data: providerCfg } = await supabaseAdmin
      .from("payment_provider_config")
      .select("provider, is_live")
      .eq("country_code", profile?.country_code ?? "ET")
      .maybeSingle();
    if (!providerCfg?.is_live) {
      return Response.json(
        { error: "Deposits aren't available in your country yet." },
        { status: 400 },
      );
    }

    let body: { amount?: number; currency?: "ETB" | "USD" };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const amount = Number(body.amount);
    const currency = body.currency === "USD" ? "USD" : "ETB";
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    const txRef = `moybirr_dep_${crypto.randomUUID()}`;

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("payment_orders")
      .insert({ user_id: user.id, purpose: "deposit", amount, tx_ref: txRef, provider: "chapa" })
      .select("id")
      .single();

    if (orderErr || !order) {
      return Response.json(
        { error: orderErr?.message ?? "Could not create payment order" },
        { status: 500 },
      );
    }

    const origin = new URL(request.url).origin;

    try {
      const { checkoutUrl } = await chapaInitialize({
        amount,
        currency,
        tx_ref: txRef,
        email: user.email ?? `${user.id}@moybirr.app`,
        callback_url: `${origin}/api/chapa/webhook`,
        return_url: `${origin}/?deposit=pending`,
      });

      // Success path — safe to log a short confirmation.
      console.log("[chapa/initiate] OK", { orderId: order.id, amount, currency });

      return Response.json({ checkoutUrl, orderId: order.id });
    } catch (e) {
      // Roll the order back so it doesn't sit around as a dangling "pending".
      await supabaseAdmin.from("payment_orders").update({ status: "failed" }).eq("id", order.id);

      // ---- DIAGNOSTIC BLOCK ------------------------------------------------
      // Print everything Chapa said and everything we sent, minus the key.
      // The key's first 14 chars are enough to tell whether it starts with
      // CHASECK_TEST- (correct) or something else (wrong key) - never log
      // the whole key.
      const message = e instanceof Error ? e.message : String(e);
      const keyPrefix = (process.env["CHAPA_SECRET_KEY"] ?? "").slice(0, 14);

      console.log("[chapa/initiate] FAILED");
      console.log("  error:", message);
      console.log("  key prefix:", keyPrefix || "(empty — env var not set or not visible to this route)");
      console.log("  amount:", amount, currency);
      console.log("  tx_ref:", txRef);
      console.log("  email:", user.email ?? "(none)");
      console.log("  callback_url:", `${origin}/api/chapa/webhook`);
      console.log("  return_url:", `${origin}/?deposit=pending`);
      if (e instanceof Error && e.stack) {
        console.log("  stack:", e.stack.split("\n").slice(0, 5).join("\n         "));
      }
      // ---- END DIAGNOSTIC BLOCK -------------------------------------------

      return Response.json({ error: message }, { status: 502 });
    }
  },
});