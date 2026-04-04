"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { Spinner } from "@/components/Spinner";
import { ChevronRight, Shield } from "lucide-react";

export default function AuthPage() {
  const { create, login, loading, error, account, storedAccounts } = useWallet();
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
    router.replace("/dashboard");
  }

  async function handleLogin(credentialId?: string) {
    await login(credentialId);
    router.replace("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col bg-mint-bg min-h-screen">
      {/* Top section — brand */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-bg/10 mb-6">
            <Shield size={28} className="text-bg/70" strokeWidth={1.5} />
          </div>
          <h1 className="text-[36px] font-bold text-bg tracking-tight">Cannes</h1>
          <p className="text-bg/50 text-[15px] mt-2">Private payments on Base</p>
        </div>
      </div>

      {/* Bottom section — actions */}
      <div className="px-6 pb-12 w-full max-w-[400px] mx-auto">
        {error && (
          <div className="mb-4 p-3.5 rounded-2xl bg-bg/10 text-bg text-[13px] text-center">
            {error}
          </div>
        )}

        {mode === "welcome" && (
          <div className="space-y-3 animate-fade-up" style={{ animationDelay: "100ms" }}>
            <button
              onClick={() => setMode("create")}
              className="w-full h-[56px] rounded-full bg-bg text-primary text-[16px] font-semibold hover:bg-bg/90 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              Create Wallet
              <ChevronRight size={18} className="text-tertiary" />
            </button>
            <button
              onClick={() =>
                storedAccounts.length > 0 ? setMode("accounts") : handleLogin()
              }
              className="w-full h-[56px] rounded-full border-2 border-bg/20 text-bg text-[16px] font-semibold hover:bg-bg/10 active:scale-[0.98] transition-all cursor-pointer"
            >
              Sign In
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
              className="w-full h-[56px] rounded-full bg-white px-6 text-[15px] text-bg placeholder:text-bg/35 focus:outline-none focus:ring-2 focus:ring-bg/20"
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={loading || !username.trim()}
              className="w-full h-[56px] rounded-full bg-bg text-primary text-[16px] font-semibold hover:bg-bg/90 active:scale-[0.98] transition-all disabled:opacity-30 cursor-pointer flex items-center justify-center"
            >
              {loading ? <Spinner size={18} /> : "Create Wallet"}
            </button>
            <button
              onClick={() => setMode("welcome")}
              className="w-full py-3 text-[14px] text-bg/50 hover:text-bg transition-colors cursor-pointer text-center"
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
                onClick={() => handleLogin(acc.credentialId)}
                disabled={loading}
                className="w-full flex items-center gap-3.5 p-4 rounded-2xl bg-white hover:bg-white/80 active:scale-[0.98] transition-all text-left disabled:opacity-30 cursor-pointer"
              >
                <div className="w-11 h-11 rounded-full bg-mint-dark/15 text-bg flex items-center justify-center text-[15px] font-bold">
                  {acc.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-bg">{acc.username}</p>
                  <p className="text-[11px] text-bg/35 font-mono truncate mt-0.5">{acc.credentialId.slice(0, 24)}</p>
                </div>
                <ChevronRight size={16} className="text-bg/25" />
              </button>
            ))}
            <button
              onClick={() => handleLogin()}
              disabled={loading}
              className="w-full h-[56px] rounded-full border-2 border-bg/20 text-bg text-[16px] font-semibold hover:bg-bg/10 active:scale-[0.98] transition-all disabled:opacity-30 cursor-pointer"
            >
              {loading ? <Spinner size={18} /> : "Use Another Passkey"}
            </button>
            <button
              onClick={() => setMode("welcome")}
              className="w-full py-3 text-[14px] text-bg/50 hover:text-bg transition-colors cursor-pointer text-center"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
