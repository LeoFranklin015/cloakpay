"use client";
import { useEffect, useRef, useState } from "react";

export function usePaymentStatus(paymentId: string | null) {
  const [status, setStatus] = useState<string>("requires_action");
  const [isFinal, setIsFinal] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!paymentId || isFinal) return;

    async function poll() {
      try {
        const res = await fetch(`/api/payments/${paymentId}/status`);
        const data = await res.json();
        setStatus(data.status);
        setIsFinal(data.isFinal);

        if (!data.isFinal) {
          timeoutRef.current = setTimeout(poll, data.pollInMs || 3000);
        }
      } catch {
        timeoutRef.current = setTimeout(poll, 5000);
      }
    }

    timeoutRef.current = setTimeout(poll, 2000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [paymentId, isFinal]);

  return { status, isFinal };
}
