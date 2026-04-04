"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Transaction = {
  paymentId: string;
  referenceId: string;
  status: string;
  fiatAmount?: { value?: string; display?: { assetSymbol?: string; decimals?: number } };
  tokenAmount?: { display?: { formatted?: string; assetSymbol?: string; networkName?: string } };
  buyer?: { accountCaip10?: string };
  createdAt: string;
};

type Stats = {
  totalRevenue: { amount: number; currency: string }[];
  totalTransactions: number;
  totalCustomers: number;
};

function formatCents(value?: string): string {
  if (!value) return "$0.00";
  return `$${(parseInt(value) / 100).toFixed(2)}`;
}

export default function DashboardOverview() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/transactions?limit=10&sortBy=date&sortDir=desc");
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setTransactions(json.data || []);
        setStats(json.stats || null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const pending = transactions.filter((t) => t.status === "requires_action" || t.status === "processing");
  const revenue = stats?.totalRevenue?.[0];

  const statCards = [
    { label: "Total Revenue", value: revenue ? `$${revenue.amount.toFixed(2)}` : "$0.00", sub: revenue?.currency || "USD", color: "bg-emerald-500" },
    { label: "Transactions", value: stats?.totalTransactions?.toString() || "0", sub: "All time", color: "bg-blue-500" },
    { label: "Customers", value: stats?.totalCustomers?.toString() || "0", sub: "Unique buyers", color: "bg-violet-500" },
    { label: "Pending", value: pending.length.toString(), sub: "Awaiting payment", color: "bg-amber-500" },
  ];

  const statusColor: Record<string, string> = {
    succeeded: "text-emerald-600",
    processing: "text-blue-600",
    requires_action: "text-amber-600",
    failed: "text-red-600",
    expired: "text-zinc-400",
    cancelled: "text-zinc-400",
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Overview</h2>
        <p className="text-zinc-500 text-sm mt-1">Your merchant payment summary</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-2 h-2 rounded-full ${stat.color}`} />
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">{loading ? "—" : stat.value}</p>
            <p className="text-xs text-zinc-400 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-8">
        <Link
          href="/dashboard/payments"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Payment
        </Link>
        <Link
          href="/dashboard/transactions"
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          View All Transactions
        </Link>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="font-semibold text-zinc-900 dark:text-white">Recent Transactions</h3>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-400">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-sm text-red-500">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-400">No transactions yet. Create your first payment!</div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {transactions.slice(0, 5).map((tx) => (
              <div key={tx.paymentId} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{tx.referenceId}</p>
                  <p className="text-xs text-zinc-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {formatCents(tx.fiatAmount?.value)}
                  </p>
                  <p className={`text-xs font-medium ${statusColor[tx.status] || "text-zinc-400"}`}>
                    {tx.status === "requires_action" ? "pending" : tx.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
