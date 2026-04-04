import { API_URL, MERCHANT_ID, CUSTOMER_API_KEY } from "./config";

function paymentHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Api-Key": CUSTOMER_API_KEY,
    "Merchant-Id": MERCHANT_ID,
  };
}

export async function createPayment(referenceId: string, amountCents: string) {
  const res = await fetch(`${API_URL}/merchant/payment`, {
    method: "POST",
    headers: paymentHeaders(),
    body: JSON.stringify({
      referenceId,
      amount: { value: amountCents, unit: "iso4217/USD" },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Payment creation failed: ${res.status}`);
  }

  return res.json(); // { paymentId, gatewayUrl, expiresAt }
}

export async function getPaymentStatus(paymentId: string) {
  const res = await fetch(`${API_URL}/merchant/payment/${paymentId}/status`, {
    headers: paymentHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Status check failed: ${res.status}`);
  }

  return res.json(); // { status, isFinal, pollInMs }
}

export async function cancelPayment(paymentId: string) {
  const res = await fetch(`${API_URL}/payments/${paymentId}/cancel`, {
    method: "POST",
    headers: paymentHeaders(),
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Cancel failed: ${res.status}`);
  }
}

export async function getTransactions(params?: {
  status?: string;
  sortBy?: string;
  sortDir?: string;
  limit?: number;
  cursor?: string;
  startTs?: string;
  endTs?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params?.sortDir) searchParams.set("sortDir", params.sortDir);
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  if (params?.startTs) searchParams.set("startTs", params.startTs);
  if (params?.endTs) searchParams.set("endTs", params.endTs);

  const qs = searchParams.toString();
  const url = `${API_URL}/merchants/payments${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, { headers: paymentHeaders() });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error(data.message || `Transactions fetch failed: ${res.status}`);
  }

  return data; // { data: PaymentRecord[], nextCursor }
}
