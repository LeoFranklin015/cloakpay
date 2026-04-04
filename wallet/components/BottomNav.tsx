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
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-line">
      <div className="flex justify-around items-center h-[56px] max-w-lg mx-auto pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
                active ? "text-mint" : "text-tertiary"
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
