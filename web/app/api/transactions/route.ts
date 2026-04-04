import { NextRequest, NextResponse } from "next/server";
import { getTransactions } from "@/lib/walletconnect";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const data = await getTransactions({
      status: searchParams.get("status") || undefined,
      sortBy: searchParams.get("sortBy") || "date",
      sortDir: searchParams.get("sortDir") || "desc",
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50,
      cursor: searchParams.get("cursor") || undefined,
      startTs: searchParams.get("startTs") || undefined,
      endTs: searchParams.get("endTs") || undefined,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
