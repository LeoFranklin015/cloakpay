import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { timeAgo } from "@/lib/format";

interface TxItemProps {
  type: string;
  network: string;
  status: string;
  amount: string | null;
  token: string | null;
  recipient: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  transfer: "Private Send",
  "wc-pay": "Payment",
  "burner-fund": "Fund",
  send: "Send",
};

export function TxItem({ type, status, amount, createdAt }: TxItemProps) {
  const label = TYPE_LABELS[type] ?? type;
  const isOutgoing = ["transfer", "send", "wc-pay"].includes(type);
  const isPending = ["pending", "processing", "signing"].includes(status);

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center">
          {isOutgoing ? (
            <ArrowUpRight size={16} className="text-secondary" />
          ) : (
            <ArrowDownLeft size={16} className="text-mint" />
          )}
        </div>
        <div>
          <p className="text-[14px] font-medium text-primary">{label}</p>
          <p className="text-[11px] text-tertiary mt-0.5">
            {isPending ? status : timeAgo(createdAt)}
          </p>
        </div>
      </div>
      {amount && (
        <p className={`text-[14px] font-semibold tabular-nums ${
          isOutgoing ? "text-primary" : "text-mint"
        }`}>
          {isOutgoing ? "-" : "+"}{amount}
        </p>
      )}
    </div>
  );
}
