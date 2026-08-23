const CHAPA_BASE_URL = "https://api.chapa.co/v1";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;

const svcHeaders = {
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  apikey: SUPABASE_SERVICE_KEY,
  "Content-Type": "application/json",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.toString().replace(/^Bearer\s+/i, "");

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  if (!userRes.ok) return res.status(401).json({ error: "Not authenticated" });
  const user = await userRes.json();
  if (!user?.id) return res.status(401).json({ error: "Not authenticated" });

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=is_blocked,country_code&limit=1`,
    { headers: svcHeaders }
  );
  const profileData = await profileRes.json();
  const profile = Array.isArray(profileData) ? profileData[0] : null;
  if (profile?.is_blocked) return res.status(403).json({ error: "This account has been blocked." });

  const countryCode = profile?.country_code ?? "ET";
  const cfgRes = await fetch(
    `${SUPABASE_URL}/rest/v1/payment_provider_config?country_code=eq.${countryCode}&select=is_live&limit=1`,
    { headers: svcHeaders }
  );
  const cfgData = await cfgRes.json();
  const cfg = Array.isArray(cfgData) ? cfgData[0] : null;
  if (cfg && cfg.is_live === false) {
    return res.status(400).json({ error: "Deposits aren't available in your country yet." });
  }

  const { amount, currency = "ETB" } = req.body ?? {};
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  const txRef = `moybirr_dep_${crypto.randomUUID()}`;

  // Use RPC to insert payment order — bypasses RLS cleanly with service role
  const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/payment_orders`, {
    method: "POST",
    headers: {
      ...svcHeaders,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: user.id,
      purpose: "deposit",
      amount: numAmount,
      tx_ref: txRef,
      provider: "chapa",
      status: "pending",
    }),
  });

  const orderText = await orderRes.text();
  let orderData;
  try { orderData = JSON.parse(orderText); } catch { orderData = null; }
  const order = Array.isArray(orderData) ? orderData[0] : null;
  if (!order?.id) {
    console.error("Order creation failed:", orderText);
    return res.status(500).json({ error: "Could not create payment order" });
  }

  const origin = `https://${req.headers.host}`;
  const chapaRes = await fetch(`${CHAPA_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: numAmount.toFixed(2),
      currency,
      tx_ref: txRef,
      email: user.email ?? `${user.id}@moybirr.app`,
      callback_url: `${origin}/api/chapa/webhook`,
      return_url: `${origin}/?deposit=pending`,
    }),
  });
  const chapaData = await chapaRes.json();
  if (!chapaRes.ok || chapaData.status !== "success" || !chapaData.data?.checkout_url) {
    await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?id=eq.${order.id}`, {
      method: "PATCH",
      headers: svcHeaders,
      body: JSON.stringify({ status: "failed" }),
    });
    return res.status(502).json({ error: chapaData.message ?? "Chapa initialize failed" });
  }

  return res.status(200).json({ checkoutUrl: chapaData.data.checkout_url, orderId: order.id });
}
