"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { shortenAddress } from "@/lib/format";
import { Spinner } from "@/components/Spinner";
import { TxItem } from "@/components/TxItem";
import { Copy, Check, Send, Zap, ArrowDownLeft, ChevronRight } from "lucide-react";

interface Balance {
  token: string;
  symbol: string;
  amount: string;
  formatted: string;
  network: string;
  type: string;
}

interface Transaction {
  id: number;
  type: string;
  network: string;
  status: string;
  amount: string | null;
  token: string | null;
  recipient: string | null;
  tx_hash: string | null;
  created_at: string;
}

export default function DashboardHome() {
  const { account, address, username, logout, network, setNetwork } = useWallet();
  const router = useRouter();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!address) return;
    async function load() {
      setLoading(true);
      const [balRes, txRes] = await Promise.all([
        fetch(`/api/balance?address=${address}`).then((r) => r.json()),
        fetch(`/api/history?address=${address}`).then((r) => r.json()),
      ]);
      setBalances(balRes.balances ?? []);
      setTransactions(txRes.transactions ?? []);
      setLoading(false);
    }
    load();
  }, [address]);

  useEffect(() => {
    if (!account && !address) router.replace("/");
  }, [account, address, router]);

  if (!account || !address) return null;

  function copyAddress() {
    navigator.clipboard.writeText(address!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const networkBalances = balances.filter((b) => b.network === network);
  const usdcBalance = networkBalances.find((b) => b.symbol === "USDC" && b.type === "onchain");
  const poolBalance = networkBalances.find((b) => b.type === "pool");
  const networkTxs = transactions.filter((t) => t.network === network);

  return (
    <div className="flex flex-col max-w-lg mx-auto w-full px-4 pt-5 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-mint/15 text-mint flex items-center justify-center text-[14px] font-bold">
            {username?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-[15px] font-semibold text-primary leading-tight">{username}</p>
            <button
              onClick={copyAddress}
              className="flex items-center gap-1 text-[11px] text-tertiary font-mono hover:text-secondary transition-colors cursor-pointer mt-0.5"
            >
              {shortenAddress(address, 5)}
              {copied ? <Check size={10} /> : <Copy size={10} />}
            </button>
          </div>
        </div>
        <button
          onClick={() => { logout(); router.replace("/"); }}
          className="text-[12px] text-tertiary hover:text-secondary transition-colors cursor-pointer"
        >
          Sign out
        </button>
      </div>

      {/* Balance Card — mint green */}
      <div className="bg-mint rounded-3xl p-6 mb-5 animate-scale-in">
        {/* Network toggle */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-bg/60 text-[11px] font-medium uppercase tracking-widest">
            {network === "mainnet" ? "Base" : "Base Sepolia"}
          </p>
          <div className="inline-flex bg-bg/15 rounded-full p-0.5">
            <button
              onClick={() => setNetwork("mainnet")}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                network === "mainnet" ? "bg-white text-bg" : "text-bg/50"
              }`}
            >
              Main
            </button>
            <button
              onClick={() => setNetwork("testnet")}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                network === "testnet" ? "bg-white text-bg" : "text-bg/50"
              }`}
            >
              Test
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-6 flex justify-center">
            <Spinner size={20} />
          </div>
        ) : (
          <>
            <p className="text-[48px] font-bold text-bg leading-none tabular-nums tracking-tight animate-count-up">
              {usdcBalance?.formatted ?? "0.00"}
              <span className="text-[20px] text-bg/50 font-medium ml-1">USDC</span>
            </p>
            {network === "testnet" && poolBalance && poolBalance.amount !== "0" && (
              <p className="text-[12px] text-bg/50 mt-2">
                + {poolBalance.formatted} {poolBalance.symbol} in privacy pool
              </p>
            )}
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6 stagger">
        {network === "testnet" ? (
          <ActionCard
            icon={<Send size={20} />}
            label="Send Privately"
            onClick={() => router.push("/dashboard/send")}
          />
        ) : (
          <ActionCard
            icon={<Zap size={20} />}
            label="Pay Merchant"
            onClick={() => router.push("/dashboard/pay")}
          />
        )}
        <ActionCard
          icon={<ArrowDownLeft size={20} />}
          label="Receive"
          onClick={copyAddress}
          secondary
        />
      </div>

      {/* Recent Activity */}
      <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[16px] font-semibold text-primary">Recent Activity</p>
          {networkTxs.length > 0 && (
            <button
              onClick={() => router.push("/dashboard/history")}
              className="flex items-center text-[13px] text-mint font-medium cursor-pointer"
            >
              See all <ChevronRight size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <Spinner />
          </div>
        ) : networkTxs.length === 0 ? (
          <div className="bg-card rounded-2xl py-14 text-center">
            <p className="text-secondary text-[14px]">No transactions yet</p>
            <p className="text-tertiary text-[12px] mt-1">
              {network === "testnet" ? "Send your first private payment" : "Make your first payment"}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl overflow-hidden">
            <div className="px-4 divide-y divide-line stagger">
              {networkTxs.slice(0, 5).map((tx) => (
                <TxItem
                  key={tx.id}
                  type={tx.type}
                  network={tx.network}
                  status={tx.status}
                  amount={tx.amount}
                  token={tx.token}
                  recipient={tx.recipient}
                  createdAt={tx.created_at}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  label,
  onClick,
  secondary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-between p-4 rounded-2xl cursor-pointer active:scale-[0.98] transition-all animate-fade-up ${
        secondary
          ? "bg-card hover:bg-elevated"
          : "bg-card hover:bg-elevated"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          secondary ? "bg-elevated text-secondary" : "bg-mint/15 text-mint"
        }`}>
          {icon}
        </div>
        <span className="text-[14px] font-medium text-primary">{label}</span>
      </div>
      <ChevronRight size={16} className="text-tertiary" />
    </button>
  );
}
