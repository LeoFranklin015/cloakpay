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

  const balances: Array<{
    token: string;
    symbol: string;
    amount: string;
    formatted: string;
    network: string;
    type: string;
  }> = [];

  // --- Mainnet: USDC on Base ---
  // --- Testnet: USDC on Base Sepolia ---
  // Fetch both in parallel — these must always work even if DB is down
  const [mainnetResult, testnetResult] = await Promise.allSettled([
    (async () => {
      const client = createPublicClient({
        chain: base,
        transport: http(BASE_MAINNET_RPC),
      });
      return client.readContract({
        address: MAINNET_USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
    })(),
    (async () => {
      const client = createPublicClient({
        chain: baseSepolia,
        transport: http(BASE_SEPOLIA_RPC),
      });
      return client.readContract({
        address: TESTNET_USDC as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
    })(),
  ]);

  const mainnetBal = mainnetResult.status === "fulfilled" ? mainnetResult.value.toString() : "0";
  balances.push({
    token: MAINNET_USDC,
    symbol: MAINNET_USDC_SYMBOL,
    amount: mainnetBal,
    formatted: formatTokenAmount(mainnetBal, MAINNET_USDC_DECIMALS),
    network: "mainnet",
    type: "onchain",
  });

  const testnetBal = testnetResult.status === "fulfilled" ? testnetResult.value.toString() : "0";
  balances.push({
    token: TESTNET_USDC,
    symbol: TESTNET_USDC_SYMBOL,
    amount: testnetBal,
    formatted: formatTokenAmount(testnetBal, TESTNET_USDC_DECIMALS),
    network: "testnet",
    type: "onchain",
  });

  // --- Testnet: Unlink pool balance (USDC) ---
  // DB-dependent — isolated so it can't break the on-chain balances above
  try {
    const account = await getAccount(address);
    if (account?.unlink_mnemonic) {
      const unlinkClient = await createUnlinkClient(account.unlink_mnemonic);
      await unlinkClient.ensureRegistered();
      const { balances: poolBalances } = await unlinkClient.getBalances({ token: TESTNET_USDC });
      const poolBal = poolBalances.find((b) => b.token === TESTNET_USDC);
      balances.push({
        token: TESTNET_USDC,
        symbol: TESTNET_USDC_SYMBOL,
        amount: poolBal?.amount ?? "0",
        formatted: formatTokenAmount(poolBal?.amount ?? "0", TESTNET_USDC_DECIMALS),
        network: "testnet",
        type: "pool",
      });
    }
  } catch {
    // DB or Unlink unavailable — skip pool balance silently
  }

  return NextResponse.json({ balances });
}
