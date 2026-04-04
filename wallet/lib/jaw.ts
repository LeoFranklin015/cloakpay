import { Account, type AccountConfig } from "@jaw.id/core";

const JAW_API_KEY = process.env.NEXT_PUBLIC_JAW_API_KEY!;

// Chain IDs
export const BASE_MAINNET = 8453;
export const BASE_SEPOLIA = 84532;

// JAW's ERC-20 paymaster (gas sponsored via USDC or free on testnet)
function getPaymasterUrl(chainId: number): string {
  return `https://api.justaname.id/proxy/v1/rpc/erc20-paymaster?chainId=${chainId}&api-key=${JAW_API_KEY}`;
}

export function getAccountConfig(
  chainId: number = BASE_MAINNET
): AccountConfig {
  return {
    chainId,
    apiKey: JAW_API_KEY,
    paymasterUrl: getPaymasterUrl(chainId),
  };
}

export function getTestnetAccountConfig(): AccountConfig {
  return getAccountConfig(BASE_SEPOLIA);
}

export async function createAccount(username: string): Promise<Account> {
  const config = getAccountConfig();
  return Account.create(config, { username });
}

export async function restoreAccount(
  credentialId?: string
): Promise<Account> {
  const config = getAccountConfig();
  return Account.get(config, credentialId);
}

export async function silentRestore(
  credentialId: string,
  publicKey: `0x${string}`
): Promise<Account> {
  const config = getAccountConfig();
  return Account.restore(config, credentialId, publicKey);
}

// Restore account on a specific chain (for testnet sends)
export async function restoreOnChain(
  credentialId: string,
  publicKey: `0x${string}`,
  chainId: number
): Promise<Account> {
  const config = getAccountConfig(chainId);
  return Account.restore(config, credentialId, publicKey);
}

export function getStoredAccounts() {
  return Account.getStoredAccounts(JAW_API_KEY);
}

export function logout() {
  Account.logout(JAW_API_KEY);
}

export { Account };
