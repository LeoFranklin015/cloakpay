"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { Home, Send, Zap, Clock } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const { network } = useWallet();

  const actionTab = network === "testnet"
    ? { href: "/dashboard/send", label: "Send", Icon: Send }
    : { href: "/dashboard/pay", label: "Pay", Icon: Zap };

  const TABS = [
    { href: "/dashboard", label: "Home", Icon: Home },
    actionTab,
    { href: "/dashboard/history", label: "Activity", Icon: Clock },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-[#1c1c1e] border-t border-white/5"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex justify-around items-center h-[52px] max-w-lg mx-auto">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
                active ? "text-[#8dd885]" : "text-white/25"
              }`}
            >
              <tab.Icon size={20} strokeWidth={active ? 2.2 : 1.5} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
