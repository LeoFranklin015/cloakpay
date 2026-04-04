"use client";

import { useState } from "react";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";

export default function CreatePayment() {
  const [amount, setAmount] = useState("");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { status, isFinal } = usePaymentStatus(paymentId);

  async function handleCreate() {
    if (!amount || parseFloat(amount) <= 0) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: amount }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setPaymentId(data.paymentId);
      setGatewayUrl(data.gatewayUrl);

      // Generate QR client-side
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(data.gatewayUrl, { width: 256 });
      setQrDataUrl(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create payment");
    } finally {
      setCreating(false);
    }
  }

  function reset() {
    setPaymentId(null);
    setGatewayUrl("");
    setQrDataUrl("");
    setAmount("");
    setError(null);
  }

  const statusLabel: Record<string, { text: string; color: string }> = {
    requires_action: { text: "Waiting for customer...", color: "text-amber-600" },
    processing: { text: "Processing payment...", color: "text-blue-600" },
    succeeded: { text: "Payment received!", color: "text-emerald-600" },
    failed: { text: "Payment failed", color: "text-red-600" },
    expired: { text: "Payment expired", color: "text-zinc-500" },
    cancelled: { text: "Payment cancelled", color: "text-zinc-500" },
  };

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Create Payment</h2>
        <p className="text-zinc-500 text-sm mt-1">Generate a payment link for your customer</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        {!paymentId ? (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Amount (USD)
              </label>
              <input
                type="number"
                placeholder="5.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              />
              <p className="text-xs text-zinc-400 mt-1">Customer pays in USDC, you enter the USD amount</p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={!amount || parseFloat(amount) <= 0 || creating}
              className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-semibold hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? "Creating..." : "Create Payment"}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Status */}
            <div className="text-center">
              <p className={`text-lg font-semibold ${statusLabel[status]?.color || "text-zinc-500"}`}>
                {statusLabel[status]?.text || status}
              </p>
            </div>

            {/* QR Code */}
            {qrDataUrl && !isFinal && (
              <div className="flex justify-center">
                <img src={qrDataUrl} alt="Payment QR Code" className="rounded-xl border border-zinc-200 dark:border-zinc-700" />
              </div>
            )}

            {/* Payment Link */}
            {gatewayUrl && !isFinal && (
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Payment Link</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={gatewayUrl}
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(gatewayUrl)}
                    className="px-3 py-2 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-zinc-400 mt-2 text-center">Send this link or QR code to your customer</p>
              </div>
            )}

            {/* Payment details */}
            <div className="text-xs text-zinc-400 space-y-1 border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <p><span className="font-medium text-zinc-500">Payment ID:</span> {paymentId}</p>
              <p><span className="font-medium text-zinc-500">Amount:</span> ${amount} USD</p>
            </div>

            {/* Actions */}
            {isFinal && (
              <button
                onClick={reset}
                className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-semibold hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
              >
                Create New Payment
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
