"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { shortenAddress } from "@/lib/format";
import { Spinner } from "@/components/Spinner";
import { TxItem } from "@/components/TxItem";
import { Copy, Check, Send, Zap, ArrowDownLeft, ChevronRight } from "lucide-react";

interface Balance {
  token: string; symbol: string; amount: string; formatted: string; network: string; type: string;
}
interface Transaction {
  id: number; type: string; network: string; status: string; amount: string | null;
  token: string | null; recipient: string | null; tx_hash: string | null; created_at: string;
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
    <div className="flex flex-col max-w-lg mx-auto w-full px-4 pt-5 pb-4 safe-bottom">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-mint/20 text-mint flex items-center justify-center text-[14px] font-bold">
            {username?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-[15px] font-semibold text-white leading-tight">{username}</p>
            <button
              onClick={copyAddress}
              className="flex items-center gap-1 text-[11px] text-white/30 font-mono hover:text-white/50 transition-colors cursor-pointer mt-0.5"
            >
              {shortenAddress(address, 5)}
              {copied ? <Check size={10} /> : <Copy size={10} />}
            </button>
          </div>
        </div>
        <button
          onClick={() => { logout(); router.replace("/"); }}
          className="text-[12px] text-white/30 hover:text-white/50 transition-colors cursor-pointer"
        >
          Sign out
        </button>
      </div>

      {/* Balance Card — mint green like MetaWallet */}
      <div className="bg-mint rounded-[24px] p-5 pb-6 mb-4 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <p className="text-mint-text/60 text-[11px] font-semibold uppercase tracking-widest">
            {network === "mainnet" ? "Base" : "Base Sepolia"}
          </p>
          <div className="inline-flex bg-[#2d3a1f]/20 rounded-full p-[3px]">
            <button
              onClick={() => setNetwork("mainnet")}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                network === "mainnet" ? "bg-white text-[#2d3a1f]" : "text-[#2d3a1f]/70"
              }`}
            >
              Main
            </button>
            <button
              onClick={() => setNetwork("testnet")}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                network === "testnet" ? "bg-white text-[#2d3a1f]" : "text-[#2d3a1f]/70"
              }`}
            >
              Test
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-4 flex justify-center"><Spinner size={20} /></div>
        ) : (
          <>
            <p className="text-[46px] font-bold text-mint-text leading-none tabular-nums tracking-tight animate-count-up">
              {usdcBalance?.formatted ?? "0.00"}
              <span className="text-[18px] text-mint-text/40 font-semibold ml-2">USDC</span>
            </p>
            {network === "testnet" && poolBalance && poolBalance.amount !== "0" && (
              <p className="text-[12px] text-mint-text/40 mt-2">
                + {poolBalance.formatted} {poolBalance.symbol} in pool
              </p>
            )}
          </>
        )}
      </div>

      {/* Action Buttons — dark cards like MetaWallet right panel */}
      <div className="grid grid-cols-2 gap-3 mb-6 stagger">
        {network === "testnet" ? (
          <ActionCard icon={<Send size={18} />} label="Send" sub="Privately" onClick={() => router.push("/dashboard/send")} />
        ) : (
          <ActionCard icon={<Zap size={18} />} label="Pay" sub="Merchant" onClick={() => router.push("/dashboard/pay")} />
        )}
        <ActionCard icon={<ArrowDownLeft size={18} />} label="Receive" sub="USDC" onClick={copyAddress} secondary />
      </div>

      {/* Recent Activity */}
      <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
        <p className="text-[15px] font-bold text-white mb-3">Recent Activity</p>

        {loading ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : networkTxs.length === 0 ? (
          <div className="bg-card rounded-[20px] py-12 text-center">
            <p className="text-white/50 text-[14px]">No transactions yet</p>
            <p className="text-white/25 text-[12px] mt-1">
              {network === "testnet" ? "Send your first private payment" : "Make your first payment"}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-[20px] overflow-hidden">
            <div className="px-4 divide-y divide-white/5 stagger">
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

function ActionCard({ icon, label, sub, onClick, secondary }: {
  icon: React.ReactNode; label: string; sub: string; onClick: () => void; secondary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-[18px] bg-card hover:bg-elevated active:scale-[0.98] transition-all cursor-pointer text-left animate-fade-up"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
        secondary ? "bg-white/8 text-white/50" : "bg-mint/15 text-mint"
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-white">{label}</p>
        <p className="text-[11px] text-white/30">{sub}</p>
      </div>
      <ChevronRight size={14} className="text-white/15" />
    </button>
  );
}
