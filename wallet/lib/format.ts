export function formatTokenAmount(
  raw: string | bigint,
  decimals: number,
  maxDisplay = 6
): string {
  const str = typeof raw === "bigint" ? raw.toString() : raw;
  if (str === "0") return "0";
  const padded = str.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  if (!frac) return whole;
  return `${whole}.${frac.slice(0, maxDisplay)}`;
}

export function shortenAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
