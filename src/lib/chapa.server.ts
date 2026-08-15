// Server-only. Never import this from a route/component file that ships to
// the client bundle — it uses the Chapa secret key.
//
// Chapa docs: https://developer.chapa.co (verify current field names/limits
// there before going live — payment provider APIs change).

const CHAPA_BASE_URL = "https://api.chapa.co/v1";

function getSecretKey(): string {
  const key = process.env["CHAPA_SECRET_KEY"];
  if (!key) {
    throw new Error(
      "Missing CHAPA_SECRET_KEY environment variable. Get a test key from the Chapa dashboard and set it before accepting real deposits.",
    );
  }
  return key;
}

export type ChapaInitializeParams = {
  amount: number;
  // Chapa's own checkout already surfaces Visa/Mastercard alongside
  // Telebirr/CBE for ETB - USD is for diaspora/foreign guests paying by
  // international card. Confirm USD is enabled on your Chapa account
  // (it's tied to your KYC tier) before relying on it in production.
  currency?: "ETB" | "USD";
  tx_ref: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  callback_url: string; // Chapa -> our webhook, server-to-server
  return_url: string; // browser redirect after checkout
};

export type ChapaInitializeResult = {
  checkoutUrl: string;
};

export async function chapaInitialize(
  params: ChapaInitializeParams,
): Promise<ChapaInitializeResult> {
  const res = await fetch(`${CHAPA_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amount.toFixed(2),
      currency: params.currency ?? "ETB",
      tx_ref: params.tx_ref,
      email: params.email,
      first_name: params.first_name,
      last_name: params.last_name,
      phone_number: params.phone_number,
      callback_url: params.callback_url,
      return_url: params.return_url,
    }),
  });

  const json = (await res.json()) as {
    status?: string;
    data?: { checkout_url?: string };
    message?: string;
  };

  if (!res.ok || json.status !== "success" || !json.data?.checkout_url) {
    throw new Error(json.message ?? "Chapa initialize failed");
  }

  return { checkoutUrl: json.data.checkout_url };
}

export type ChapaVerifyResult = {
  status: "success" | "failed" | "pending";
  amount: number;
  currency: string;
  tx_ref: string;
  chapaRef: string;
};

// CRITICAL: always call this from the webhook handler and trust *this*
// result, not the raw webhook body. A webhook call by itself only tells you
// "something happened" - it is not proof of payment on its own.
export async function chapaVerify(txRef: string): Promise<ChapaVerifyResult> {
  const res = await fetch(
    `${CHAPA_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`,
    {
      headers: { Authorization: `Bearer ${getSecretKey()}` },
    },
  );

  const json = (await res.json()) as {
    status?: string;
    data?: {
      status?: string;
      amount?: string | number;
      currency?: string;
      tx_ref?: string;
      reference?: string;
    };
    message?: string;
  };

  if (!res.ok || json.status !== "success" || !json.data) {
    throw new Error(json.message ?? "Chapa verify failed");
  }

  const d = json.data;
  return {
    status: d.status === "success" ? "success" : d.status === "pending" ? "pending" : "failed",
    amount: Number(d.amount ?? 0),
    currency: d.currency ?? "ETB",
    tx_ref: d.tx_ref ?? txRef,
    chapaRef: d.reference ?? "",
  };
}

// Verifies the inbound webhook actually came from Chapa. Chapa signs the
// raw request body with your webhook secret (HMAC SHA256) in the
// `Chapa-Signature` header. Confirm the exact header name and algorithm in
// the current Chapa webhook docs before relying on this in production -
// double-check against your dashboard's webhook settings.
export async function isValidChapaSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const secret = process.env["CHAPA_WEBHOOK_SECRET"];
  if (!secret || !signatureHeader) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time-ish comparison.
  if (computed.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

export type ChapaBank = { id: number; name: string; code: string };

export async function chapaGetBanks(): Promise<ChapaBank[]> {
  const res = await fetch(`${CHAPA_BASE_URL}/banks`, {
    headers: { Authorization: `Bearer ${getSecretKey()}` },
  });
  const json = (await res.json()) as {
    status?: string;
    data?: { id: number; name: string; swift?: string; acct_length?: number }[];
    message?: string;
  };
  if (!res.ok || json.status !== "success" || !json.data) {
    throw new Error(json.message ?? "Could not load bank list");
  }
  return json.data.map((b) => ({ id: b.id, name: b.name, code: String(b.id) }));
}

export type ChapaTransferParams = {
  account_name: string;
  account_number: string;
  bank_code: string;
  amount: number;
  reference: string;
};

export type ChapaTransferResult = {
  status: "queued" | "success" | "failed";
  message: string;
};

// Sends money OUT to a real bank account. Per Chapa's own docs: they don't
// verify the account belongs to who you think it does - double-check the
// account details with the user before calling this (e.g. show a
// confirmation step with the name they typed) since a transfer to a wrong
// account is not their responsibility to reverse.
export async function chapaTransferToBank(
  params: ChapaTransferParams,
): Promise<ChapaTransferResult> {
  const res = await fetch(`${CHAPA_BASE_URL}/transfers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      account_name: params.account_name,
      account_number: params.account_number,
      bank_code: params.bank_code,
      amount: params.amount.toFixed(2),
      currency: "ETB",
      reference: params.reference,
    }),
  });

  const json = (await res.json()) as { status?: string; message?: string };

  if (!res.ok || (json.status !== "success" && json.status !== "pending" && json.status !== "queued")) {
    return { status: "failed", message: json.message ?? "Transfer failed" };
  }
  // Chapa transfers are async - "success" here means "accepted for
  // processing", not "money has landed". Final state arrives via webhook.
  return { status: "queued", message: json.message ?? "Transfer queued" };
}
