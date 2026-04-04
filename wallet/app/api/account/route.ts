import { NextRequest, NextResponse } from "next/server";
import { upsertAccount, getAccount, setUnlinkMnemonic } from "@/lib/db";
import { generateMnemonic, createUnlinkClient } from "@/lib/unlink";

// POST: Register account + generate Unlink mnemonic
export async function POST(req: NextRequest) {
  try {
    const { address, username } = await req.json();
    if (!address || !username) {
      return NextResponse.json({ error: "address and username required" }, { status: 400 });
    }

    // Always save the account first
    await upsertAccount(address, username);
    let account = await getAccount(address);

    // Try to set up Unlink (non-blocking — don't fail the whole registration)
    if (!account?.unlink_mnemonic) {
      try {
        const mnemonic = generateMnemonic();
        const client = await createUnlinkClient(mnemonic);
        await client.ensureRegistered();
        const unlinkAddress = await client.getAddress();
        await setUnlinkMnemonic(address, mnemonic, unlinkAddress);
        account = await getAccount(address);
        console.log("[account] Unlink registered:", unlinkAddress);
      } catch (unlinkErr) {
        console.error("[account] Unlink registration failed (non-fatal):", unlinkErr);
        // Account is saved, Unlink can be retried later
      }
    }

    return NextResponse.json({
      address: account!.address,
      username: account!.username,
      unlinkAddress: account!.unlink_address ?? null,
      hasUnlink: !!account!.unlink_mnemonic,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[account] Fatal error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET: Retrieve account info
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  const account = await getAccount(address);
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // If no Unlink yet, try to register now
  if (!account.unlink_mnemonic) {
    try {
      const mnemonic = generateMnemonic();
      const client = await createUnlinkClient(mnemonic);
      await client.ensureRegistered();
      const unlinkAddress = await client.getAddress();
      await setUnlinkMnemonic(address, mnemonic, unlinkAddress);
      console.log("[account] Unlink registered on GET:", unlinkAddress);
      return NextResponse.json({
        address: account.address,
        username: account.username,
        unlinkAddress,
        hasUnlink: true,
      });
    } catch {
      // Still return account without Unlink
    }
  }

  return NextResponse.json({
    address: account.address,
    username: account.username,
    unlinkAddress: account.unlink_address ?? null,
    hasUnlink: !!account.unlink_mnemonic,
  });
}
