import {
  createUnlink,
  createUnlinkClient as createLowLevelClient,
  unlinkAccount,
  unlinkEvm,
  getEnvironment,
  BurnerWallet,
  type UnlinkClient,
  type AccountKeys,
} from "@unlink-xyz/sdk";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import * as bip39 from "bip39";
import { TESTNET_ENGINE_URL } from "./constants";

const UNLINK_API_KEY = process.env.UNLINK_API_KEY!;

export function generateMnemonic(): string {
  return bip39.generateMnemonic();
}

export async function createUnlinkClient(mnemonic: string): Promise<UnlinkClient> {
  const account = unlinkAccount.fromMnemonic({ mnemonic });
  const client = createUnlink({
    apiKey: UNLINK_API_KEY,
    account,
    engineUrl: TESTNET_ENGINE_URL,
  });
  return client;
}

/** Returns the low-level API client, account keys, and high-level client for burner operations. */
export async function createUnlinkClients(mnemonic: string) {
  const accountProvider = unlinkAccount.fromMnemonic({ mnemonic });
  const apiClient = createLowLevelClient(TESTNET_ENGINE_URL, UNLINK_API_KEY);
  const highLevelClient = createUnlink({
    apiKey: UNLINK_API_KEY,
    account: accountProvider,
    engineUrl: TESTNET_ENGINE_URL,
  });
  const accountKeys = await accountProvider.getAccountKeys();
  const envInfo = await getEnvironment(apiClient);
  return { apiClient, highLevelClient, accountKeys, envInfo };
}

export async function createUnlinkClientWithEvm(
  mnemonic: string,
  privateKey: `0x${string}`
): Promise<UnlinkClient> {
  const account = unlinkAccount.fromMnemonic({ mnemonic });
  const evmAccount = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });
  const walletClient = createWalletClient({
    account: evmAccount,
    chain: baseSepolia,
    transport: http(),
  });

  const evm = unlinkEvm.fromViem({ walletClient, publicClient });

  return createUnlink({
    apiKey: UNLINK_API_KEY,
    account,
    evm,
    engineUrl: TESTNET_ENGINE_URL,
  });
}

export { BurnerWallet, bip39 };
export type { AccountKeys };
