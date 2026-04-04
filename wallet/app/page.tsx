"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { Spinner } from "@/components/Spinner";
import { ChevronRight } from "lucide-react";

export default function AuthPage() {
  const { create, login, discoverPasskey, loading, error, account, storedAccounts } = useWallet();
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<"welcome" | "create" | "accounts">("welcome");
  const router = useRouter();

  useEffect(() => {
    if (account) router.replace("/dashboard");
  }, [account, router]);

  if (account) return null;

  async function handleCreate() {
    if (!username.trim()) return;
    await create(username.trim());
  }

  async function handleLogin(credentialId?: string) {
    await login(credentialId);
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "#8dd885 url(/hero-bg.svg) center/cover no-repeat" }}>
      {/* Brand — sits at 40% from top */}
      <div className="flex-[3] flex items-end justify-center pb-8">
        <div className="text-center animate-fade-up">
          <h1 className="text-[40px] font-bold text-[#1a1a1a] tracking-tight">Cannes</h1>
          <p className="text-[#1a1a1a]/40 text-[15px] mt-2 font-medium">Private payments on Base</p>
        </div>
      </div>

      {/* Buttons — bottom area */}
      <div className="flex-[4] flex flex-col justify-end px-6 pb-10">
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-white/80 text-[#ff3b30] text-[13px] text-center">
            {error}
          </div>
        )}

        {mode === "welcome" && (
          <div className="space-y-3 animate-fade-up" style={{ animationDelay: "100ms" }}>
            <button
              onClick={() => setMode("create")}
              className="w-full h-[56px] rounded-full bg-white text-[#1a1a1a] text-[16px] font-semibold active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
            >
              Create Wallet
              <ChevronRight size={16} className="text-[#1a1a1a]/30" />
            </button>
            <button
              onClick={() =>
                storedAccounts.length > 0 ? setMode("accounts") : discoverPasskey()
              }
              disabled={loading}
              className="w-full h-[56px] rounded-full border-2 border-white/40 text-[#1a1a1a] text-[16px] font-semibold active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center"
            >
              {loading ? <Spinner size={18} /> : "Sign In"}
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-3 animate-fade-up">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Choose a username"
              className="w-full h-[56px] rounded-full bg-white/90 px-6 text-[15px] text-[#1a1a1a] placeholder:text-[#1a1a1a]/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={loading || !username.trim()}
              className="w-full h-[56px] rounded-full bg-white text-[#1a1a1a] text-[16px] font-semibold active:scale-[0.98] transition-all disabled:opacity-30 cursor-pointer flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
            >
              {loading ? <Spinner size={18} /> : "Create Wallet"}
            </button>
            <button
              onClick={() => setMode("welcome")}
              className="w-full py-3 text-[14px] text-[#1a1a1a]/40 cursor-pointer text-center"
            >
              Back
            </button>
          </div>
        )}

        {mode === "accounts" && (
          <div className="space-y-3 animate-fade-up">
            {storedAccounts.map((acc) => (
              <button
                key={acc.credentialId}
                onClick={() => discoverPasskey()}
                disabled={loading}
                className="w-full flex items-center gap-3.5 p-4 rounded-2xl bg-white/80 backdrop-blur-sm active:scale-[0.98] transition-all text-left disabled:opacity-30 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-[#8dd885]/20 text-[#1a1a1a] flex items-center justify-center text-[14px] font-bold">
                  {acc.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#1a1a1a]">{acc.username}</p>
                  <p className="text-[10px] text-[#aaa] font-mono truncate mt-0.5">{acc.credentialId.slice(0, 24)}</p>
                </div>
                <ChevronRight size={14} className="text-[#ccc]" />
              </button>
            ))}
            <button
              onClick={() => discoverPasskey()}
              disabled={loading}
              className="w-full h-[56px] rounded-full border-2 border-white/40 text-[#1a1a1a] text-[16px] font-semibold active:scale-[0.98] transition-all disabled:opacity-30 cursor-pointer"
            >
              {loading ? <Spinner size={18} /> : "Use Another Passkey"}
            </button>
            <button
              onClick={() => setMode("welcome")}
              className="w-full py-3 text-[14px] text-[#1a1a1a]/40 cursor-pointer text-center"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
