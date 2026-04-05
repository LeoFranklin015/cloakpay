"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { Home, Send, RefreshCw, Clock } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const { network } = useWallet();

  const TABS = [
    { href: "/dashboard", Icon: Home },
    { href: network === "testnet" ? "/dashboard/send" : "/dashboard/pay", Icon: Send },
    { href: "/dashboard/subscriptions", Icon: RefreshCw },
    { href: "/dashboard/history", Icon: Clock },
  ];

  return (
    <nav
      className="fixed bottom-[-30px] inset-x-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex justify-center pb-5 pt-2">
        <div className="flex items-center gap-3 bg-[#2a2a2e] rounded-full px-3 py-2">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  active
                    ? "bg-[#8dd885] text-[#1a1a1a]"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                <tab.Icon size={20} strokeWidth={active ? 2.2 : 1.5} />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
