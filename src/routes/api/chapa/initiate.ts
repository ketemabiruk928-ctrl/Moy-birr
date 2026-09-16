import { createFileRoute } from "@tanstack/react-router";
import { chapaInitialize } from "@/lib/chapa.server";

// POST /api/chapa/initiate  { amount: number }
// Creates a pending payment_orders row for the logged-in user, then asks
// Chapa for a checkout URL. The wallet balance is NOT touched here - only
// the webhook (after Chapa confirms payment) can do that.
export const Route = createFileRoute("/api/chapa/initiate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Verify the caller with their own bearer token so we know which
        // user this deposit belongs to - never trust a user_id in the body.
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
          .select("is_blocked, country_code, email")
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

        // Chapa requires a real email. Our phone-login accounts use
        // <phone>@moybirr.app as a synthetic address, which Chapa rejects
        // with {"error":{"email":["validation.email"]}}. Prefer a real email
        // stored on the user's profile; fall back to the auth email only if
        // it isn't one of our @moybirr.app placeholders.
        const authEmail = user.email ?? "";
        const profileEmail = profile?.email ?? "";
        const realEmail =
          (profileEmail && !profileEmail.endsWith("@moybirr.app") ? profileEmail : "") ||
          (authEmail && !authEmail.endsWith("@moybirr.app") ? authEmail : "");

        if (!realEmail) {
          return Response.json(
            {
              error:
                "Please add an email to your profile before depositing. " +
                "Open Profile → fill the Email field.",
            },
            { status: 400 },
          );
        }

        const txRef = `moybirr_dep_${crypto.randomUUID()}`;

        const { data: order, error: orderErr } = await supabaseAdmin
          .from("payment_orders")
          .insert({
            user_id: user.id,
            purpose: "deposit",
            amount,
            tx_ref: txRef,
            provider: "chapa",
          })
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
            email: realEmail,
            callback_url: `${origin}/api/chapa/webhook`,
            return_url: `${origin}/?deposit=pending`,
          });

          console.log("[chapa/initiate] OK", { orderId: order.id, amount, currency });
          return Response.json({ checkoutUrl, orderId: order.id });
        } catch (e) {
          // Roll the order back so it doesn't sit around as a dangling "pending".
          await supabaseAdmin
            .from("payment_orders")
            .update({ status: "failed" })
            .eq("id", order.id);

          const message = e instanceof Error ? e.message : String(e);
          const keyPrefix = (process.env["CHAPA_SECRET_KEY"] ?? "").slice(0, 14);

          console.log("[chapa/initiate] FAILED");
          console.log("  error:", message);
          console.log(
            "  key prefix:",
            keyPrefix || "(empty — env var not set or not visible to this route)",
          );
          console.log("  amount:", amount, currency);
          console.log("  tx_ref:", txRef);
          console.log("  email:", realEmail);

          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});