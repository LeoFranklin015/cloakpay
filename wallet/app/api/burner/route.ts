import { NextRequest, NextResponse } from "next/server";
import { insertBurner, getActiveBurner } from "@/lib/db";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// POST: Create a mainnet burner wallet
export async function POST(req: NextRequest) {
  try {
    const { ownerAddress, token, amount } = await req.json();

    const privateKey = generatePrivateKey();
    const burnerAccount = privateKeyToAccount(privateKey);

    insertBurner(
      ownerAddress,
      burnerAccount.address,
      privateKey,
      "mainnet",
      token,
      amount
    );

    return NextResponse.json({
      burnerAddress: burnerAccount.address,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create burner" },
      { status: 500 }
    );
  }
}

// GET: Get active burner for user
export async function GET(req: NextRequest) {
  const ownerAddress = req.nextUrl.searchParams.get("address");
  const network = req.nextUrl.searchParams.get("network") ?? "mainnet";
  if (!ownerAddress) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  const burner = getActiveBurner(ownerAddress, network);
  if (!burner) {
    return NextResponse.json({ burner: null });
  }

  return NextResponse.json({
    burner: {
      address: burner.burner_address,
      status: burner.status,
      token: burner.token,
      amount: burner.amount,
    },
  });
}
