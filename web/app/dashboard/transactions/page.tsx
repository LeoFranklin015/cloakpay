"use client";

import { useEffect, useState } from "react";

type Transaction = {
  paymentId: string;
  referenceId: string;
  status: string;
  isTerminal: boolean;
  fiatAmount?: { display?: { formatted?: string } };
  tokenAmount?: { display?: { formatted?: string; assetSymbol?: string; networkName?: string } };
  buyer?: { accountCaip10?: string; accountProviderName?: string };
  transaction?: { hash?: string; networkId?: string };
  createdAt: string;
};

const statusColors: Record<string, string> = {
  succeeded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  requires_action: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  cancelled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [cursor, setCursor] = useState<string | null>(null);

  async function loadTransactions(statusFilter?: string, pageCursor?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sortBy: "date", sortDir: "desc", limit: "20" });
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (pageCursor) params.set("cursor", pageCursor);

      const res = await fetch(`/api/transactions?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setTransactions(pageCursor ? [...transactions, ...(json.data || [])] : (json.data || []));
      setCursor(json.nextCursor || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function shortenAddress(caip10?: string) {
    if (!caip10) return "—";
    const parts = caip10.split(":");
    const addr = parts[parts.length - 1];
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Transactions</h2>
        <p className="text-zinc-500 text-sm mt-1">View all payment transactions</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {["all", "succeeded", "processing", "requires_action", "failed", "expired"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {s === "requires_action" ? "pending" : s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Reference</th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Amount</th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Crypto</th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Buyer</th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Status</th>
              <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-5 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {!loading && transactions.map((tx) => (
              <tr key={tx.paymentId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <td className="px-5 py-4 text-sm font-medium text-zinc-900 dark:text-white">{tx.referenceId}</td>
                <td className="px-5 py-4 text-sm text-zinc-900 dark:text-white">{tx.fiatAmount?.display?.formatted || "—"}</td>
                <td className="px-5 py-4 text-sm text-zinc-500">{tx.tokenAmount?.display?.formatted || "—"}</td>
                <td className="px-5 py-4 text-sm font-mono text-zinc-500">{shortenAddress(tx.buyer?.accountCaip10)}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${statusColors[tx.status] || "bg-zinc-100 text-zinc-500"}`}>
                    {tx.status === "requires_action" ? "pending" : tx.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-zinc-500">{new Date(tx.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && <div className="px-5 py-12 text-center text-sm text-zinc-400">Loading...</div>}
        {error && <div className="px-5 py-12 text-center text-sm text-red-500">{error}</div>}
        {!loading && !error && transactions.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-zinc-400">No transactions found.</div>
        )}

        {cursor && !loading && (
          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <button
              onClick={() => loadTransactions(filter, cursor)}
              className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
