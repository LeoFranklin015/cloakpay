"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { Spinner } from "@/components/Spinner";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { parseUnits } from "viem";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

type Sub = {
  _id: string;
  name: string;
  description: string;
  amount: string;
  period: string;
  spender: string;
  status: string;
};

const PERIOD_SECONDS: Record<string, number> = {
  day: 86400,
  week: 604800,
  month: 2592000,
  year: 31536000,
};

export default function SubscribePageWrapper() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Spinner size={32} /></div>}>
      <SubscribePage />
    </Suspense>
  );
}

function SubscribePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subId = searchParams.get("id");
  const { account, address } = useWallet();

  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!subId) { setError("No subscription ID"); setLoading(false); return; }
    fetch(`/api/subscriptions/${subId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setSub(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [subId]);

  async function handleApprove() {
    if (!account || !address || !sub) return;
    setApproving(true);
    setError(null);

    try {
      // Grant permission: allow spender to call USDC.transfer, with spend limit per period
      const expiry = Math.floor(Date.now() / 1000) + PERIOD_SECONDS.year; // 1 year expiry
      const allowance = parseUnits(sub.amount, 6).toString();

      const result = await account.grantPermissions(
        expiry,
        sub.spender as `0x${string}`,
        {
          calls: [{ target: USDC as `0x${string}`, functionSignature: "transfer(address,uint256)" }],
          spends: [{ token: USDC as `0x${string}`, allowance, unit: sub.period as "day" | "week" | "month" | "year" }],
        }
      );

      console.log("[subscribe] grantPermissions result:", result);

      // Store permissionId + add as subscriber in DB
      await fetch("/api/subscriptions/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: sub._id,
          subscriber: address,
          permissionId: result.permissionId,
        }),
      });

      setDone(true);
    } catch (e) {
      console.error("[subscribe] Error:", e);
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setApproving(false);
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
        <p className="text-[16px] font-semibold text-white">Subscribe</p>
        <div className="w-9" />
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner size={32} />
        </div>
      )}

      {error && !done && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center text-[28px]">✕</div>
          <p className="text-[18px] font-bold text-white">Error</p>
          <p className="text-red-400/80 text-[13px] text-center max-w-[280px]">{error}</p>
          <button onClick={() => router.back()}
            className="mt-4 h-[48px] px-8 rounded-full bg-white/[0.06] text-white text-[14px] font-medium cursor-pointer">
            Go Back
          </button>
        </div>
      )}

      {sub && !done && !error && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 space-y-5">
          <div className="w-16 h-16 rounded-full bg-mint/15 flex items-center justify-center">
            <ShieldCheck size={28} className="text-mint" />
          </div>

          <p className="text-[22px] font-bold text-white">{sub.name}</p>
          {sub.description && (
            <p className="text-[13px] text-white/40 text-center max-w-[280px]">{sub.description}</p>
          )}

          <div className="w-full rounded-2xl bg-white/[0.04] p-5 space-y-3">
            <div className="flex justify-between">
              <span className="text-[13px] text-white/40">Amount</span>
              <span className="text-[15px] font-semibold text-white">{sub.amount} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[13px] text-white/40">Period</span>
              <span className="text-[15px] font-medium text-white capitalize">{sub.period}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[13px] text-white/40">Spender</span>
              <span className="text-[12px] font-mono text-white/60">{sub.spender.slice(0, 8)}...{sub.spender.slice(-6)}</span>
            </div>
          </div>

          <p className="text-[11px] text-white/25 text-center max-w-[260px]">
            This will allow the merchant to charge {sub.amount} USDC per {sub.period} from your account. You can revoke anytime.
          </p>

          <button
            onClick={handleApprove}
            disabled={approving || !account}
            className="w-full h-[54px] rounded-full bg-mint text-mint-text text-[16px] font-semibold disabled:opacity-30 cursor-pointer"
          >
            {approving ? "Approving..." : "Approve Subscription"}
          </button>

          {sub.status === "active" && (
            <p className="text-mint text-[13px] font-medium">Already subscribed</p>
          )}
        </div>
      )}

      {done && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-mint/15 text-mint flex items-center justify-center text-[28px] font-bold">✓</div>
          <p className="text-[22px] font-bold text-white">Subscribed!</p>
          <p className="text-white/40 text-[14px] text-center">You can manage this subscription from your dashboard.</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 h-[48px] px-8 rounded-full bg-white/[0.06] text-white text-[14px] font-medium cursor-pointer hover:bg-white/[0.1] transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
