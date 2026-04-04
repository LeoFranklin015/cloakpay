import { NextRequest, NextResponse } from "next/server";
import { getAccount } from "@/lib/db";
import { createUnlinkClient } from "@/lib/unlink";
import {
  TESTNET_USDC, TESTNET_USDC_DECIMALS, TESTNET_USDC_SYMBOL,
  MAINNET_USDC, MAINNET_USDC_DECIMALS, MAINNET_USDC_SYMBOL,
  BASE_MAINNET_RPC, BASE_SEPOLIA_RPC,
} from "@/lib/constants";
import { formatTokenAmount } from "@/lib/format";
import { createPublicClient, http, parseAbi } from "viem";
import { base, baseSepolia } from "viem/chains";

const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
]);

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  try {
    const account = getAccount(address);
    const balances: Array<{
      token: string;
      symbol: string;
      amount: string;
      formatted: string;
      network: string;
      type: string;
    }> = [];

    // --- Mainnet: USDC on Base ---
    try {
      const mainnetClient = createPublicClient({
        chain: base,
        transport: http(BASE_MAINNET_RPC),
      });
      const mainnetBal = await mainnetClient.readContract({
        address: MAINNET_USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      balances.push({
        token: MAINNET_USDC,
        symbol: MAINNET_USDC_SYMBOL,
        amount: mainnetBal.toString(),
        formatted: formatTokenAmount(mainnetBal.toString(), MAINNET_USDC_DECIMALS),
        network: "mainnet",
        type: "onchain",
      });
    } catch {
      balances.push({
        token: MAINNET_USDC,
        symbol: MAINNET_USDC_SYMBOL,
        amount: "0",
        formatted: "0",
        network: "mainnet",
        type: "onchain",
      });
    }

    // --- Testnet: USDC on Base Sepolia ---
    try {
      const testnetClient = createPublicClient({
        chain: baseSepolia,
        transport: http(BASE_SEPOLIA_RPC),
      });
      const testnetBal = await testnetClient.readContract({
        address: TESTNET_USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      balances.push({
        token: TESTNET_USDC,
        symbol: TESTNET_USDC_SYMBOL,
        amount: testnetBal.toString(),
        formatted: formatTokenAmount(testnetBal.toString(), TESTNET_USDC_DECIMALS),
        network: "testnet",
        type: "onchain",
      });
    } catch {
      balances.push({
        token: TESTNET_USDC,
        symbol: TESTNET_USDC_SYMBOL,
        amount: "0",
        formatted: "0",
        network: "testnet",
        type: "onchain",
      });
    }

    // --- Testnet: Unlink pool balance (USDC) ---
    if (account?.unlink_mnemonic) {
      try {
        const client = await createUnlinkClient(account.unlink_mnemonic);
        await client.ensureRegistered();
        const { balances: poolBalances } = await client.getBalances({ token: TESTNET_USDC });
        const poolBal = poolBalances.find((b) => b.token === TESTNET_USDC);
        balances.push({
          token: TESTNET_USDC,
          symbol: TESTNET_USDC_SYMBOL,
          amount: poolBal?.amount ?? "0",
          formatted: formatTokenAmount(poolBal?.amount ?? "0", TESTNET_USDC_DECIMALS),
          network: "testnet",
          type: "pool",
        });
      } catch {
        // skip
      }
    }

    return NextResponse.json({ balances });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
