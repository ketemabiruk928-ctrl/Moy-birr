const CHAPA_BASE_URL = "https://api.chapa.co/v1";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;
const CHAPA_WEBHOOK_SECRET = process.env.CHAPA_WEBHOOK_SECRET;

async function isValidSignature(rawBody, signatureHeader) {
  if (!CHAPA_WEBHOOK_SECRET || !signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(CHAPA_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  if (computed.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  return diff === 0;
}

async function chapaVerify(txRef) {
  const res = await fetch(`${CHAPA_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${CHAPA_SECRET_KEY}` },
  });
  const json = await res.json();
  if (!res.ok || json.status !== "success" || !json.data) throw new Error(json.message ?? "Verify failed");
  const d = json.data;
  return {
    status: d.status === "success" ? "success" : d.status === "pending" ? "pending" : "failed",
    amount: Number(d.amount ?? 0),
    chapaRef: d.reference ?? "",
  };
}

async function supabaseRpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      apikey: SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  return res;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("method not allowed");

  const rawBody = JSON.stringify(req.body);
  const signature = req.headers["chapa-signature"];
  const valid = await isValidSignature(rawBody, signature);
  if (!valid) {
    console.error("[webhook] invalid signature");
    return res.status(200).send("ok");
  }

  const txRef = req.body?.tx_ref ?? req.body?.reference;
  if (!txRef) return res.status(400).send("missing tx_ref");

  const ordersRes = await fetch(
    `${SUPABASE_URL}/rest/v1/payment_orders?tx_ref=eq.${encodeURIComponent(txRef)}&select=id,amount,status&limit=1`,
    { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } }
  );
  const [order] = await ordersRes.json();

  if (order) {
    if (order.status === "verified") return res.status(200).send("ok");
    const verified = await chapaVerify(txRef);
    if (verified.status !== "success") {
      await fetch(`${SUPABASE_URL}/rest/v1/payment_orders?id=eq.${order.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "failed" }),
      });
      return res.status(200).send("ok");
    }
    await supabaseRpc("admin_credit_wallet", { _order_id: order.id, _provider_ref: verified.chapaRef });
    return res.status(200).send("ok");
  }

  const payoutsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/payout_requests?tx_ref=eq.${encodeURIComponent(txRef)}&select=id,status&limit=1`,
    { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } }
  );
  const [payout] = await payoutsRes.json();

  if (payout) {
    if (payout.status === "completed" || payout.status === "failed") return res.status(200).send("ok");
    const verified = await chapaVerify(txRef);
    await supabaseRpc("admin_finalize_payout", {
      _order_id: payout.id,
      _success: verified.status === "success",
      _provider_ref: verified.chapaRef || null,
      _failure_reason: verified.status === "success" ? null : "Transfer failed at provider",
    });
    return res.status(200).send("ok");
  }

  return res.status(200).send("ok");
}
