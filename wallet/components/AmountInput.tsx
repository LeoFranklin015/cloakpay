"use client";

interface AmountInputProps {
  value: string;
  onChange: (val: string) => void;
  symbol: string;
  maxAmount?: string;
}

export function AmountInput({ value, onChange, symbol, maxAmount }: AmountInputProps) {
  return (
    <div className="text-center py-8">
      <div className="flex items-baseline justify-center">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, "");
            if (v.split(".").length <= 2) onChange(v);
          }}
          placeholder="0"
          className="text-6xl font-light text-center bg-transparent outline-none w-52 text-primary placeholder:text-tertiary tabular-nums tracking-tight"
        />
        <span className="text-xl text-tertiary font-normal ml-1">{symbol}</span>
      </div>
      {maxAmount && (
        <button
          onClick={() => onChange(maxAmount)}
          className="mt-3 text-xs text-secondary hover:text-primary transition-colors cursor-pointer"
        >
          Use max — {maxAmount} {symbol}
        </button>
      )}
    </div>
  );
}
