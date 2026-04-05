"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { QRScanner } from "@/components/QRScanner";
import { Spinner } from "@/components/Spinner";
import { ArrowLeft, ShieldCheck, ShieldOff, ScanLine, X } from "lucide-react";

type Sub = {
  _id: string;
  name: string;
  description: string;
  amount: string;
  period: string;
  spender: string;
  status: "active" | "revoked";
  permissionId: string | null;
  lastChargedAt: string | null;
  created_at: string;
};

export default function MySubscriptionsPage() {
  const router = useRouter();
  const { account, address } = useWallet();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    const res = await fetch(`/api/subscriptions/mine?address=${address}`);
    const data = await res.json();
    setSubs(data.subscriptions || []);
    setLoading(false);
  }, [address]);

  useEffect(() => { load(); }, [load]);

  function handleScan(data: string) {
    setScanning(false);
    setScanError(null);

    // Extract subscription ID from URL
    try {
      const url = new URL(data);
      const id = url.searchParams.get("id");
      if (id) {
        router.push(`/dashboard/subscribe?id=${id}`);
        return;
      }
      // Try path-based: /dashboard/subscribe/abc123
      const match = url.pathname.match(/subscribe.*?([a-f0-9]{24})/i);
      if (match) {
        router.push(`/dashboard/subscribe?id=${match[1]}`);
        return;
      }
    } catch {
      // Not a URL — try as raw ID
      if (/^[a-f0-9]{24}$/i.test(data.trim())) {
        router.push(`/dashboard/subscribe?id=${data.trim()}`);
        return;
      }
    }
    setScanError("Not a valid subscription QR code");
  }

  async function handleRevoke(sub: Sub) {
    if (!account || !sub.permissionId) return;
    setRevoking(sub._id);

    try {
      await account.revokePermission(sub.permissionId as `0x${string}`);

      await fetch("/api/subscriptions/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriberId: sub._id }),
      });

      await load();
    } catch (e) {
      console.error("[revoke] Error:", e);
      alert(e instanceof Error ? e.message : "Failed to revoke");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="flex flex-col flex-1 max-w-lg mx-auto w-full min-h-dvh"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center cursor-pointer hover:bg-white/[0.1] transition-colors">
          <ArrowLeft size={18} className="text-white/60" />
        </button>
        <p className="text-[16px] font-semibold text-white">My Subscriptions</p>
        <button
          onClick={() => { setScanning(!scanning); setScanError(null); }}
          className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center cursor-pointer hover:bg-white/[0.1] transition-colors"
        >
          {scanning ? <X size={18} className="text-white/60" /> : <ScanLine size={18} className="text-white/60" />}
        </button>
      </div>

      {/* QR Scanner */}
      {scanning && (
        <div className="px-4 mb-4">
          <p className="text-[13px] text-white/40 text-center mb-3">Scan a subscription QR code</p>
          <div className="relative rounded-2xl overflow-hidden bg-black/40 aspect-square">
            <QRScanner onScan={handleScan} onError={(err) => setScanError(err)} />
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-[15%] border-2 border-white/20 rounded-2xl" />
            </div>
          </div>
          {scanError && (
            <p className="text-center text-[13px] text-red-400 mt-2">{scanError}</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner size={32} />
        </div>
      ) : subs.length === 0 && !scanning ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-3">
          <ShieldCheck size={40} className="text-white/15" />
          <p className="text-white/40 text-[14px]">No subscriptions yet</p>
          <button
            onClick={() => setScanning(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-mint/15 text-mint text-[13px] font-medium cursor-pointer"
          >
            <ScanLine size={16} />
            Scan to subscribe
          </button>
        </div>
      ) : (
        <div className="px-4 space-y-3 mt-2">
          {subs.map((sub) => (
            <div key={sub._id} className="rounded-2xl bg-white/[0.04] p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-semibold text-white">{sub.name}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      sub.status === "active"
                        ? "bg-mint/15 text-mint"
                        : "bg-red-500/15 text-red-400"
                    }`}>
                      {sub.status}
                    </span>
                  </div>
                  <p className="text-[13px] text-white/40 mt-1">
                    {sub.amount} USDC / {sub.period}
                  </p>
                  <p className="text-[11px] text-white/20 font-mono mt-1">
                    {sub.spender.slice(0, 8)}...{sub.spender.slice(-6)}
                  </p>
                  {sub.lastChargedAt && (
                    <p className="text-[11px] text-white/20 mt-1">
                      Last charged {new Date(sub.lastChargedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {sub.status === "active" && (
                  <button
                    onClick={() => handleRevoke(sub)}
                    disabled={revoking === sub._id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-[12px] font-medium cursor-pointer hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    <ShieldOff size={14} />
                    {revoking === sub._id ? "Revoking..." : "Revoke"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
