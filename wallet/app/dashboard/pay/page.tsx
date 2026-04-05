"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { QRScanner } from "@/components/QRScanner";
import { getPayClient } from "@/lib/walletconnect-pay";
import { Spinner } from "@/components/Spinner";
import { formatTokenAmount } from "@/lib/format";
import { ArrowLeft, ScanLine, Keyboard } from "lucide-react";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

type PayStep =
  | "scan"
  | "fetching"
  | "collect_data"
  | "fund_burner"
  | "funding"
  | "signing"
  | "confirming"
  | "success"
  | "error";

interface CollectField {
  id: string;
  name: string;
  required: boolean;
  type?: string;
  fieldType?: string;
}

export default function PayPage() {
  const { account, address } = useWallet();
  const router = useRouter();

  const [step, setStep] = useState<PayStep>("scan");
  const [inputMode, setInputMode] = useState<"camera" | "paste">("camera");
  const [pasteValue, setPasteValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [burnerAddress, setBurnerAddress] = useState<string | null>(null);

  const [collectFields, setCollectFields] = useState<CollectField[]>([]);
  const [collectValues, setCollectValues] = useState<Record<string, string>>({});

  const pendingRef = useRef<{
    paymentId: string;
    paymentLink: string;
    burnerAddress: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collectedData: any;
  } | null>(null);

  function reset() {
    setStep("scan");
    setInputMode("camera");
    setPasteValue("");
    setError(null);
    setTxResult(null);
    setPaymentInfo(null);
    setBurnerAddress(null);
    setCollectFields([]);
    setCollectValues({});
    pendingRef.current = null;
  }

  function getCaip10(addr: string) {
    return [
      `eip155:1:${addr}`,
      `eip155:8453:${addr}`,
      `eip155:10:${addr}`,
      `eip155:137:${addr}`,
      `eip155:42161:${addr}`,
    ];
  }

  // Entry — QR scan or paste
  const handleScanOrPaste = useCallback(
    async (raw: string) => {
      if (!address) return;
      setError(null);

      const paymentLink = raw.trim();
      if (!paymentLink) {
        setError("Invalid QR code or payment link");
        return;
      }

      setStep("fetching");

      try {
        const client = getPayClient();
        const result = await client.getPaymentOptions({
          paymentLink,
          accounts: getCaip10(address),
          includePaymentInfo: true,
        });

        console.log("[pay] getPaymentOptions:", JSON.stringify(result, null, 2));

        setPaymentInfo(result.info ?? null);

        // Create burner wallet
        const burnerRes = await fetch("/api/burner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", ownerAddress: address, token: "USDC", amount: "0" }),
        });
        const burnerData = await burnerRes.json();
        if (burnerData.error) throw new Error(burnerData.error);

        setBurnerAddress(burnerData.burnerAddress);
        pendingRef.current = {
          paymentId: result.paymentId,
          paymentLink,
          burnerAddress: burnerData.burnerAddress,
          collectedData: null,
        };

        // Check collectData
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const topCollect = (result as any).collectData;
        const optionCollect = result.options?.[0]?.collectData;
        const collect = topCollect ?? optionCollect;

        if (collect?.fields?.length > 0) {
          setCollectFields(collect.fields);
          setStep("collect_data");
        } else {
          setStep("fund_burner");
        }
      } catch (e: unknown) {
        console.error("[pay] handleScanOrPaste error:", e);
        setError(e instanceof Error ? e.message : "Failed to fetch payment");
        setStep("error");
      }
    },
    [address]
  );

  function handleSubmitCollectData() {
    for (const field of collectFields) {
      if (field.required && !collectValues[field.id]?.trim()) {
        setError(`"${field.name}" is required.`);
        return;
      }
    }
    setError(null);

    if (pendingRef.current) {
      pendingRef.current.collectedData = [
        ...collectFields.map((f) => ({ id: f.id, value: collectValues[f.id] ?? "" })),
        { id: "tosConfirmed", value: "true" },
      ];
    }
    setStep("fund_burner");
  }

  // Fund burner → re-fetch options → sign → confirm
  async function handleFundAndPay() {
    if (!account || !pendingRef.current || !paymentInfo) return;
    setStep("funding");
    setError(null);

    try {
      const pending = pendingRef.current;
      const client = getPayClient();

      // Calculate USDC amount
      const amountValue = paymentInfo.amount?.value ?? "0";
      const decimals = paymentInfo.amount?.display?.decimals ?? 2;
      const padded = amountValue.padStart(decimals + 1, "0");
      const usdcWhole = padded.slice(0, -decimals) || "0";
      const usdcFrac = padded.slice(-decimals);
      const usdcFloat = parseFloat(`${usdcWhole}.${usdcFrac}`);
      const usdcRaw = BigInt(Math.ceil(usdcFloat * 1e6));

      // JAW sends USDC to burner
      const selector = "0xa9059cbb";
      const paddedTo = pending.burnerAddress.slice(2).padStart(64, "0");
      const paddedAmt = usdcRaw.toString(16).padStart(64, "0");
      const calldata = `${selector}${paddedTo}${paddedAmt}` as `0x${string}`;

      await account.sendTransaction([
        { to: USDC_BASE as `0x${string}`, data: calldata },
      ]);

      await new Promise((r) => setTimeout(r, 10000));

      // Re-fetch options with burner address
      const result = await client.getPaymentOptions({
        paymentLink: pending.paymentLink,
        accounts: getCaip10(pending.burnerAddress),
        includePaymentInfo: true,
      });

      console.log("[pay] Re-fetch options:", JSON.stringify(result, null, 2));

      const option = result.options?.[0];
      if (!option) throw new Error("No payment options available after funding");

      // Get actions to sign
      setStep("signing");

      const actions = await client.getRequiredPaymentActions({
        paymentId: pending.paymentId,
        optionId: option.id,
      });

      console.log("[pay] Actions to sign:", actions.length);

      // Server signs with burner key
      const signRes = await fetch("/api/burner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sign",
          ownerAddress: address,
          burnerAddress: pending.burnerAddress,
          actions,
        }),
      });
      const signData = await signRes.json();
      if (signData.error) throw new Error(signData.error);

      // Confirm payment
      setStep("confirming");

      const confirmParams: {
        paymentId: string;
        optionId: string;
        signatures: string[];
        collectedData?: { id: string; value: string }[];
      } = {
        paymentId: pending.paymentId,
        optionId: option.id,
        signatures: signData.signatures,
      };
      if (pending.collectedData?.length > 0) {
        confirmParams.collectedData = pending.collectedData;
      }

      let confirmResult = await client.confirmPayment(confirmParams);
      console.log("[pay] Confirm:", confirmResult.status, "isFinal:", confirmResult.isFinal);

      while (!confirmResult.isFinal && confirmResult.pollInMs) {
        await new Promise((r) => setTimeout(r, confirmResult.pollInMs!));
        confirmResult = await client.confirmPayment(confirmParams);
      }

      if (confirmResult.status === "succeeded") {
        setTxResult(confirmResult.info?.txId ?? pending.paymentId);
        setStep("success");
      } else {
        setError(`Payment ${confirmResult.status}`);
        setStep("error");
      }
    } catch (e: unknown) {
      console.error("[pay] handleFundAndPay error:", e);
      setError(e instanceof Error ? e.message : "Payment failed");
      setStep("error");
    }
  }

  return (
    <div className="flex flex-col flex-1 max-w-lg mx-auto w-full min-h-dvh"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center cursor-pointer hover:bg-white/[0.1] transition-colors">
          <ArrowLeft size={18} className="text-white/60" />
        </button>
        <p className="text-[16px] font-semibold text-white">Pay Merchant</p>
        <div className="w-9" />
      </div>

      {/* Scan / Paste */}
      {step === "scan" && (
        <div className="flex-1 flex flex-col px-5 space-y-4">
          <div className="rounded-2xl bg-white/[0.04] p-3 text-center">
            <p className="text-[11px] text-white/25 uppercase tracking-wider">Base Mainnet</p>
            <p className="text-[12px] text-white/40 mt-0.5">Private Payment via WalletConnect</p>
          </div>

          {inputMode === "camera" ? (
            <>
              <p className="text-[13px] text-white/40 text-center">
                Scan a WalletConnect Pay QR code
              </p>
              <div className="relative rounded-2xl overflow-hidden bg-black/40 aspect-square">
                <QRScanner
                  onScan={handleScanOrPaste}
                  onError={(err) => setError(err)}
                />
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-[15%] border-2 border-white/20 rounded-2xl" />
                </div>
              </div>
              <button
                onClick={() => setInputMode("paste")}
                className="flex items-center justify-center gap-2 h-[46px] rounded-2xl bg-white/[0.06] text-white/50 text-[13px] font-medium cursor-pointer hover:bg-white/[0.1] transition-colors"
              >
                <Keyboard size={16} />
                Paste link instead
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && pasteValue.trim() && handleScanOrPaste(pasteValue)}
                placeholder="Paste payment link..."
                className="w-full h-[50px] rounded-2xl bg-white/[0.06] border border-white/5 px-4 text-[13px] text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-mint/30 transition-colors"
              />
              <button
                onClick={() => pasteValue.trim() && handleScanOrPaste(pasteValue)}
                disabled={!pasteValue.trim()}
                className="w-full h-[50px] rounded-2xl bg-mint text-mint-text text-[15px] font-semibold disabled:opacity-30 cursor-pointer"
              >
                Fetch Payment
              </button>
              <button
                onClick={() => setInputMode("camera")}
                className="flex items-center justify-center gap-2 h-[46px] rounded-2xl bg-white/[0.06] text-white/50 text-[13px] font-medium cursor-pointer hover:bg-white/[0.1] transition-colors"
              >
                <ScanLine size={16} />
                Scan QR code instead
              </button>
            </>
          )}

          {error && (
            <p className="text-center text-[13px] text-red-400">{error}</p>
          )}
        </div>
      )}

      {/* Fetching */}
      {step === "fetching" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-3">
          <Spinner size={32} />
          <p className="text-white/50 text-[14px]">Fetching payment...</p>
        </div>
      )}

      {/* Collect Data */}
      {step === "collect_data" && (
        <div className="flex-1 flex flex-col px-5 space-y-4">
          {paymentInfo && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04]">
              <div className="flex-1">
                <p className="font-medium text-white">{paymentInfo.merchant?.name ?? "Merchant"}</p>
                <p className="text-[12px] text-white/35">
                  ${formatTokenAmount(paymentInfo.amount?.value ?? "0", paymentInfo.amount?.display?.decimals ?? 2)}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="font-medium text-white text-[15px]">Identity Verification</p>
            <p className="text-[12px] text-white/35 mt-1">Required for compliance before payment.</p>
          </div>

          {collectFields.map((field) => (
            <div key={field.id}>
              <label className="block text-[12px] text-white/50 mb-1.5">
                {field.name}{field.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <input
                type={field.fieldType === "date" || field.type === "date" ? "date" : "text"}
                value={collectValues[field.id] ?? ""}
                onChange={(e) => setCollectValues((v) => ({ ...v, [field.id]: e.target.value }))}
                placeholder={field.name}
                className="w-full h-[48px] rounded-2xl bg-white/[0.06] border border-white/5 px-4 text-white placeholder:text-white/20 focus:outline-none focus:border-mint/30 transition-colors"
              />
            </div>
          ))}

          {error && <p className="text-red-400 text-[13px]">{error}</p>}
          <p className="text-[11px] text-white/25">By continuing, you accept the Terms of Service.</p>

          <button
            onClick={handleSubmitCollectData}
            className="w-full h-[50px] rounded-2xl bg-mint text-mint-text text-[15px] font-semibold cursor-pointer"
          >
            Continue
          </button>
          <button onClick={reset} className="w-full text-[13px] text-white/40 cursor-pointer">Cancel</button>
        </div>
      )}

      {/* Fund Burner */}
      {step === "fund_burner" && paymentInfo && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 space-y-5">
          <p className="text-[13px] text-white/40">Payment to</p>
          <p className="text-[20px] font-bold text-white">{paymentInfo.merchant?.name ?? "Merchant"}</p>
          <p className="text-[36px] font-bold text-white">
            ${formatTokenAmount(paymentInfo.amount?.value ?? "0", paymentInfo.amount?.display?.decimals ?? 2)}
          </p>

          <div className="w-full rounded-2xl bg-white/[0.04] p-4 space-y-2.5">
            <p className="text-[11px] text-white/50 font-medium uppercase tracking-wider">How it works</p>
            <p className="text-[12px] text-white/35">1. Your payment is routed privately</p>
            <p className="text-[12px] text-white/35">2. Transaction is signed securely</p>
            <p className="text-[12px] text-white/35">3. WalletConnect settles with the merchant</p>
            <p className="text-[12px] text-white/35">4. No on-chain link between you and the merchant</p>
          </div>

          <button
            onClick={handleFundAndPay}
            className="w-full h-[54px] rounded-full bg-mint text-mint-text text-[16px] font-semibold cursor-pointer"
          >
            Approve & Pay
          </button>
          <button onClick={reset} className="text-[13px] text-white/40 cursor-pointer">Cancel</button>
        </div>
      )}

      {/* Processing */}
      {(step === "funding" || step === "signing" || step === "confirming") && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="relative w-28 h-28 mb-8">
            <div className="absolute inset-0 rounded-full border-2 border-mint/20 animate-[spin_8s_linear_infinite]" />
            <div className="absolute inset-3 rounded-full border-2 border-transparent border-t-mint/40 border-r-mint/40 animate-[spin_3s_linear_infinite_reverse]" />
            <div className="absolute inset-6 rounded-full border-2 border-transparent border-t-mint animate-[spin_1.5s_linear_infinite]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-mint animate-pulse" />
            </div>
          </div>

          <p className="text-white text-[16px] font-semibold mb-1">
            {step === "funding" && "Sending payment..."}
            {step === "signing" && "Signing privately..."}
            {step === "confirming" && "Confirming with merchant..."}
          </p>
          <p className="text-white/25 text-[13px] mb-8">This may take a moment</p>

          <div className="w-full max-w-[260px]">
            <div className="relative pl-8">
              <div className="absolute left-[11px] top-1 bottom-1 w-[2px] bg-white/5" />
              <div className="space-y-5">
                <ProcessStep label="Send USDC" done={step !== "funding"} active={step === "funding"} />
                <ProcessStep label="Sign transaction" done={step === "confirming"} active={step === "signing"} />
                <ProcessStep label="Confirm with merchant" done={false} active={step === "confirming"} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {step === "success" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-mint/15 text-mint flex items-center justify-center text-[28px] font-bold">✓</div>
          <p className="text-[22px] font-bold text-white">Paid!</p>
          <p className="text-white/40 text-[14px]">Payment settled privately</p>
          {txResult && (
            <p className="text-[11px] text-white/20 font-mono break-all max-w-[280px] text-center">ID: {txResult}</p>
          )}
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 h-[48px] px-8 rounded-full bg-white/[0.06] text-white text-[14px] font-medium cursor-pointer hover:bg-white/[0.1] transition-colors"
          >
            Done
          </button>
        </div>
      )}

      {/* Error */}
      {step === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center text-[28px]">✕</div>
          <p className="text-[22px] font-bold text-white">Failed</p>
          <p className="text-red-400/80 text-[13px] text-center max-w-[280px]">{error}</p>
          <button
            onClick={reset}
            className="mt-4 h-[48px] px-8 rounded-full bg-white/[0.06] text-white text-[14px] font-medium cursor-pointer hover:bg-white/[0.1] transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

function ProcessStep({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-3 relative">
      <div className={`absolute -left-8 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition-all duration-500 ${
        done
          ? "bg-mint text-[#1a1a1a]"
          : active
            ? "bg-mint/20 text-mint ring-4 ring-mint/10 animate-pulse"
            : "bg-white/8 text-white/20"
      }`}>
        {done ? "✓" : active ? "●" : "○"}
      </div>
      <span className={`text-[14px] transition-all duration-300 ${
        active ? "text-white font-semibold" : done ? "text-mint font-medium" : "text-white/20"
      }`}>
        {label}
      </span>
    </div>
  );
}
