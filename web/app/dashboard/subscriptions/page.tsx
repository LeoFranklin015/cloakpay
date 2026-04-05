"use client";

import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";

type Subscriber = {
  _id: string;
  subscriber: string;
  status: "active" | "revoked";
  permissionId: string | null;
  lastChargedAt: string | null;
  created_at: string;
};

type Plan = {
  _id: string;
  name: string;
  description: string;
  amount: string;
  period: string;
  spender: string;
  created_at: string;
  subscribers?: Subscriber[];
};

const WALLET_URL = process.env.NEXT_PUBLIC_WALLET_URL || "https://venmo-x.vercel.app";

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [qrData, setQrData] = useState<{ id: string; dataUrl: string } | null>(null);
  const [charging, setCharging] = useState<string | null>(null);
  const [chargeResult, setChargeResult] = useState<{ id: string; msg: string } | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState("month");
  const [spender, setSpender] = useState("");
  const [creating, setCreating] = useState(false);

  const loadPlans = useCallback(async () => {
    const res = await fetch("/api/subscriptions");
    const data = await res.json();
    // For each plan, fetch subscribers
    const plansWithSubs = await Promise.all(
      (data.plans || []).map(async (plan: Plan) => {
        const subRes = await fetch(`/api/subscriptions/${plan._id}`);
        const subData = await subRes.json();
        return { ...plan, subscribers: subData.subscribers || [] };
      })
    );
    setPlans(plansWithSubs);
    setLoading(false);
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  // Auto-fetch spender smart account address
  useEffect(() => {
    fetch("/api/subscriptions/spender")
      .then((r) => r.json())
      .then((data) => { if (data.address) setSpender(data.address); })
      .catch(() => {});
  }, []);

  async function handleCreate() {
    if (!name || !amount || !spender) return;
    setCreating(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, amount, period, spender }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setShowCreate(false);
      setName(""); setDescription(""); setAmount("");
      await loadPlans();
      await showQR(data.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function showQR(id: string) {
    const url = `${WALLET_URL}/dashboard/subscribe?id=${id}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
    setQrData({ id, dataUrl });
  }

  async function handleCharge(subscriberId: string) {
    setCharging(subscriberId);
    setChargeResult(null);
    try {
      const res = await fetch(`/api/subscriptions/${subscriberId}/charge`, { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setChargeResult({ id: subscriberId, msg: "Charged!" });
      await loadPlans();
    } catch (e) {
      setChargeResult({ id: subscriberId, msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setCharging(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this plan?")) return;
    await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
    await loadPlans();
  }

  const statusColor: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    revoked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Subscriptions</h2>
          <p className="text-zinc-500 text-sm mt-1">Recurring USDC payments via JAW permissions</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Plan
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">New Subscription Plan</h3>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name (e.g. Netflix)"
              className="w-full h-11 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white" />
            <div className="flex gap-3">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="USDC amount" type="number" step="0.01"
                className="flex-1 h-11 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white" />
              <select value={period} onChange={(e) => setPeriod(e.target.value)}
                className="h-11 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white">
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Spender (smart account)</label>
              <input value={spender} onChange={(e) => setSpender(e.target.value)} placeholder="Loading spender address..."
                className="w-full h-11 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 text-sm font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 h-11 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={creating || !name || !amount || !spender}
                className="flex-1 h-11 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-200">
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-200 dark:border-zinc-800 text-center space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Scan to Subscribe</h3>
            <p className="text-xs text-zinc-500">Have the customer scan this QR with their CloakPay wallet</p>
            <img src={qrData.dataUrl} alt="Subscription QR" className="w-64 h-64 mx-auto rounded-xl" />
            <p className="text-[10px] text-zinc-400 font-mono break-all">{`${WALLET_URL}/dashboard/subscribe?id=${qrData.id}`}</p>
            <button onClick={() => setQrData(null)}
              className="w-full h-11 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Plans List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-sm text-zinc-400">Loading...</div>
        ) : plans.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-sm text-zinc-400">No plans yet. Create your first subscription plan!</div>
        ) : (
          plans.map((plan) => {
            const activeSubs = plan.subscribers?.filter((s) => s.status === "active") || [];
            const totalSubs = plan.subscribers?.length || 0;
            const isExpanded = expandedPlan === plan._id;

            return (
              <div key={plan._id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {/* Plan Header */}
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer" onClick={() => setExpandedPlan(isExpanded ? null : plan._id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{plan.name}</p>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {activeSubs.length} active / {totalSubs} total
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {plan.amount} USDC / {plan.period}
                      {plan.description && <> &middot; {plan.description}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button onClick={(e) => { e.stopPropagation(); showQR(plan._id); }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      QR
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(plan._id); }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                      Delete
                    </button>
                    <svg className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Subscribers List (expanded) */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800">
                    {totalSubs === 0 ? (
                      <div className="px-5 py-6 text-center text-xs text-zinc-400">No subscribers yet. Share the QR code!</div>
                    ) : (
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {plan.subscribers!.map((sub) => (
                          <div key={sub._id} className="px-5 py-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                                  {sub.subscriber.slice(2, 4).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-mono text-zinc-900 dark:text-white">
                                    {sub.subscriber.slice(0, 6)}...{sub.subscriber.slice(-4)}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColor[sub.status]}`}>
                                      {sub.status}
                                    </span>
                                    <span className="text-[10px] text-zinc-400">
                                      Since {new Date(sub.created_at).toLocaleDateString()}
                                    </span>
                                    {sub.lastChargedAt && (
                                      <span className="text-[10px] text-zinc-400">
                                        &middot; Last charged {new Date(sub.lastChargedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {sub.status === "active" && (
                                <button
                                  onClick={() => handleCharge(sub._id)}
                                  disabled={charging === sub._id}
                                  className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shrink-0"
                                >
                                  {charging === sub._id ? "Charging..." : `Charge ${plan.amount} USDC`}
                                </button>
                              )}
                            </div>
                            {chargeResult?.id === sub._id && (
                              <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${
                                chargeResult.msg === "Charged!"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                  : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                              }`}>
                                {chargeResult.msg}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
