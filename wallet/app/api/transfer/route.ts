import { NextRequest, NextResponse } from "next/server";
import {
  getAccount,
  insertTransaction,
  updateTransaction,
  insertBurner,
  updateBurnerStatus,
} from "@/lib/db";
import { createUnlinkClients, BurnerWallet } from "@/lib/unlink";
import { TESTNET_USDC, TESTNET_USDC_DECIMALS, TESTNET_USDC_SYMBOL } from "@/lib/constants";
import {
  createUnlink,
  unlinkAccount,
  unlinkEvm,
} from "@unlink-xyz/sdk";
import { TESTNET_ENGINE_URL } from "@/lib/constants";
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import * as bip39 from "bip39";

const UNLINK_API_KEY = process.env.UNLINK_API_KEY!;
const FUNDING_PRIVATE_KEY = process.env.FUNDING_PRIVATE_KEY! as `0x${string}`;
const TRANSFER_AMOUNT_DECIMALS = TESTNET_USDC_DECIMALS;

const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address, uint256) returns (bool)",
]);

/**
 * POST /api/transfer
 *
 * Replicates the EXACT privateTransfer.js flow:
 * 1. Setup EVM wallet + Unlink account
 * 2. ensureErc20Approval
 * 3. deposit into pool
 * 4. BurnerWallet.create
 * 5. burner.fundFromPool
 * 6. Poll burner status
 * 7. Burner transfer to recipient
 * 8. Dispose burner
 *
 * Instead of a raw private key, we use a server-side ephemeral key
 * that gets funded by the JAW account first (client sends USDC to it).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phase = body.phase ?? "full";
    console.log("[transfer] Phase:", phase, "Body:", JSON.stringify(body));

    if (phase === "prepare") {
      return await handlePrepare(body);
    } else if (phase === "execute") {
      return await handleExecute(body);
    }

    return NextResponse.json({ error: "Invalid phase. Use 'prepare' or 'execute'." }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[transfer] Top-level error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Phase "prepare": Create an ephemeral EVM key, return its address.
 * Client will send USDC from JAW to this address.
 */
async function handlePrepare(body: { ownerAddress: string; amount: string }) {
  try {
    const { ownerAddress, amount } = body;
    console.log("[transfer:prepare] ownerAddress:", ownerAddress, "amount:", amount);

    const account = getAccount(ownerAddress);
    console.log("[transfer:prepare] DB account:", account ? "found" : "not found", "hasUnlink:", !!account?.unlink_mnemonic);

    if (!account?.unlink_mnemonic) {
      return NextResponse.json({ error: "No Unlink account. Re-login to create one." }, { status: 400 });
    }

    const { generatePrivateKey } = await import("viem/accounts");
    const ephemeralKey = generatePrivateKey();
    const ephemeralAccount = privateKeyToAccount(ephemeralKey);

    const amountRaw = BigInt(
      Math.round(parseFloat(amount) * 10 ** TRANSFER_AMOUNT_DECIMALS)
    ).toString();

    insertBurner(ownerAddress, ephemeralAccount.address, ephemeralKey, "testnet", TESTNET_USDC, amountRaw);
    console.log("[transfer:prepare] Ephemeral:", ephemeralAccount.address, "amount:", amountRaw);

    return NextResponse.json({
      ephemeralAddress: ephemeralAccount.address,
      amountRaw,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[transfer:prepare] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Phase "execute": Client has sent USDC to ephemeral address.
 * Now run the full privateTransfer.js flow server-side.
 */
async function handleExecute(body: {
  ownerAddress: string;
  recipientAddress: string;
  amount: string;
  ephemeralAddress: string;
}) {
  const { ownerAddress, recipientAddress, amount, ephemeralAddress } = body;

  const dbAccount = getAccount(ownerAddress);
  if (!dbAccount?.unlink_mnemonic) {
    return NextResponse.json({ error: "No Unlink account" }, { status: 400 });
  }

  // Get the ephemeral key from DB
  const burnerRow = await import("@/lib/db").then(m =>
    m.getActiveBurner(ownerAddress, "testnet")
  );
  if (!burnerRow || burnerRow.burner_address.toLowerCase() !== ephemeralAddress.toLowerCase()) {
    return NextResponse.json({ error: "Ephemeral wallet not found" }, { status: 400 });
  }

  const ephemeralKey = burnerRow.private_key as `0x${string}`;
  const amountRaw = burnerRow.amount;

  // Record transaction
  const txRow = insertTransaction({
    ownerAddress,
    type: "transfer",
    network: "testnet",
    status: "starting",
    amount: `${amount} ${TESTNET_USDC_SYMBOL}`,
    token: TESTNET_USDC,
    recipient: recipientAddress,
  });
  const txId = Number(txRow.lastInsertRowid);

  // ── Step 1: Setup EVM wallet + Unlink account (like privateTransfer.js) ──
  updateTransaction(txId, { status: "setup" });

  const evmAccount = privateKeyToAccount(ephemeralKey);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
  const walletClient = createWalletClient({
    account: evmAccount,
    chain: baseSepolia,
    transport: http(),
  });

  const unlinkAcc = unlinkAccount.fromMnemonic({ mnemonic: dbAccount.unlink_mnemonic });
  const evm = unlinkEvm.fromViem({ walletClient, publicClient });

  const client = createUnlink({
    apiKey: UNLINK_API_KEY,
    account: unlinkAcc,
    evm,
    engineUrl: TESTNET_ENGINE_URL,
  });

  await client.ensureRegistered();

  // ── Step 1b: Fund ephemeral with ETH for gas from funding wallet ──
  updateTransaction(txId, { status: "funding_gas" });
  console.log("[transfer:execute] Funding ephemeral", evmAccount.address, "with ETH for gas...");

  const fundingAccount = privateKeyToAccount(FUNDING_PRIVATE_KEY);
  const fundingWalletClient = createWalletClient({
    account: fundingAccount,
    chain: baseSepolia,
    transport: http(),
  });

  const gasFundTx = await fundingWalletClient.sendTransaction({
    to: evmAccount.address,
    value: BigInt("10000000000000000"), // 0.01 ETH
  });
  console.log("[transfer:execute] Gas fund tx:", gasFundTx);
  await publicClient.waitForTransactionReceipt({ hash: gasFundTx });

  // Verify ETH arrived
  let ethBal = BigInt(0);
  for (let i = 0; i < 10; i++) {
    ethBal = await publicClient.getBalance({ address: evmAccount.address });
    console.log("[transfer:execute] Ephemeral ETH balance:", ethBal.toString());
    if (ethBal > BigInt(0)) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (ethBal === BigInt(0)) {
    updateTransaction(txId, { status: "failed" });
    return NextResponse.json({ error: "Failed to fund ephemeral with ETH", txId }, { status: 500 });
  }

  // ── Step 2: Check USDC + Approve Permit2 ──
  updateTransaction(txId, { status: "approving" });

  // Verify USDC arrived from JAW
  let tokenBalance = BigInt(0);
  for (let i = 0; i < 10; i++) {
    tokenBalance = await publicClient.readContract({
      address: TESTNET_USDC as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [evmAccount.address],
    });
    console.log("[transfer:execute] Ephemeral USDC balance:", tokenBalance.toString());
    if (tokenBalance > BigInt(0)) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (tokenBalance === BigInt(0)) {
    updateTransaction(txId, { status: "failed" });
    return NextResponse.json({
      error: `Ephemeral wallet ${evmAccount.address} has no USDC. JAW transfer may not have confirmed yet.`,
      txId,
    }, { status: 400 });
  }

  console.log("[transfer:execute] Approving Permit2...");
  await client.ensureErc20Approval({ token: TESTNET_USDC, amount: amountRaw });
  console.log("[transfer:execute] Permit2 approved");

  // ── Step 3: Deposit into privacy pool ──
  updateTransaction(txId, { status: "depositing" });

  const deposit = await client.deposit({ token: TESTNET_USDC, amount: amountRaw });
  updateTransaction(txId, { unlinkTxId: deposit.txId });

  await client.pollTransactionStatus(deposit.txId, {
    intervalMs: 3000,
    timeoutMs: 120_000,
  });

  // Wait for pool balance
  for (let i = 0; i < 20; i++) {
    const { balances } = await client.getBalances({ token: TESTNET_USDC });
    const bal = balances.find((b) => b.token === TESTNET_USDC);
    if (bal && BigInt(bal.amount) > BigInt(0)) break;
    await new Promise((r) => setTimeout(r, 3000));
  }

  // ── Step 4: Create burner wallet ──
  updateTransaction(txId, { status: "creating_burner" });

  const burner = await BurnerWallet.create();

  // ── Step 5: Fund burner from pool ──
  updateTransaction(txId, { status: "funding_burner" });

  const { apiClient, accountKeys, envInfo } =
    await createUnlinkClients(dbAccount.unlink_mnemonic);

  const fund = await burner.fundFromPool(apiClient, {
    senderKeys: accountKeys,
    token: TESTNET_USDC,
    amount: amountRaw,
    environment: envInfo.name,
  });

  await client.pollTransactionStatus(fund.txId, {
    intervalMs: 3000,
    timeoutMs: 120_000,
  });

  // ── Step 6: Poll burner status ──
  for (let i = 0; i < 40; i++) {
    const statusObj = await burner.getStatus(apiClient);
    if (statusObj.status === "funded") break;
    if (statusObj.status === "gas_funding_failed") {
      updateTransaction(txId, { status: "failed" });
      return NextResponse.json({ error: "Gas funding failed", txId }, { status: 500 });
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  // ── Step 7: Burner transfer to recipient ──
  updateTransaction(txId, { status: "sending" });

  const burnerWalletClient = createWalletClient({
    account: burner.toViemAccount(),
    chain: baseSepolia,
    transport: http(),
  });

  const burnerBalance = await publicClient.readContract({
    address: TESTNET_USDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [burner.address as `0x${string}`],
  });

  const txHash = await burnerWalletClient.writeContract({
    address: TESTNET_USDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [recipientAddress as `0x${string}`, burnerBalance],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  updateTransaction(txId, { status: "completed", txHash });

  // ── Step 8: Dispose burner ──
  try { await burner.dispose(apiClient); } catch { /* ok */ }
  await burner.deleteKey();
  updateBurnerStatus(ephemeralAddress, "disposed");

  return NextResponse.json({
    success: true,
    txId,
    txHash,
    burnerAddress: burner.address,
  });
}
