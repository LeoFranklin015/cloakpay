import { NextRequest, NextResponse } from "next/server";
import { createPayment } from "@/lib/walletconnect";

export async function POST(req: NextRequest) {
  try {
    const { amountUsd, referenceId } = await req.json();

    if (!amountUsd) {
      return NextResponse.json({ error: "amountUsd is required" }, { status: 400 });
    }

    const cents = Math.round(parseFloat(amountUsd) * 100).toString();
    const refId = referenceId || `order-${Date.now()}`;
    const payment = await createPayment(refId, cents);

    return NextResponse.json(payment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
