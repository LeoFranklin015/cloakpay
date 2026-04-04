import { NextRequest, NextResponse } from "next/server";
import { getTransactions } from "@/lib/db";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  const transactions = await getTransactions(address);
  return NextResponse.json({ transactions });
}
