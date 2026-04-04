import { Loader2 } from "lucide-react";

export function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 className="animate-spin text-secondary" size={size} />;
}
