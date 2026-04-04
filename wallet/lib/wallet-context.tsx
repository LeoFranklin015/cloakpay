"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { Account } from "@jaw.id/core";
import {
  createAccount,
  restoreAccount,
  silentRestore,
  restoreOnChain,
  getStoredAccounts,
  logout as jawLogout,
  BASE_SEPOLIA,
} from "./jaw";

type Network = "mainnet" | "testnet";

interface WalletContextType {
  account: Account | null;
  address: string | null;
  username: string | null;
  loading: boolean;
  error: string | null;
  network: Network;
  setNetwork: (n: Network) => void;
  create: (username: string) => Promise<void>;
  login: (credentialId?: string) => Promise<void>;
  discoverPasskey: () => Promise<void>;
  logout: () => void;
  getTestnetAccount: () => Promise<Account | null>;
  storedAccounts: Array<{ credentialId: string; username: string }>;
}

const WalletContext = createContext<WalletContextType | null>(null);

async function registerWithServer(address: string, username: string) {
  try {
    const res = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, username }),
    });
    const text = await res.text();
    if (text) {
      const data = JSON.parse(text);
      if (data.error) console.error("[registerWithServer]", data.error);
      else console.log("[registerWithServer] OK:", data);
    } else {
      console.warn("[registerWithServer] Empty response");
    }
  } catch (e) {
    console.error("[registerWithServer] Failed:", e);
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<Network>("mainnet");
  const [storedAccounts, setStoredAccounts] = useState<
    Array<{ credentialId: string; username: string }>
  >([]);

  useEffect(() => {
    const stored = getStoredAccounts();
    setStoredAccounts(
      stored.map((a) => ({
        credentialId: a.credentialId,
        username: a.username ?? "Unknown",
      }))
    );

    // Auto-restore from JAW's localStorage auth state (no passkey prompt)
    try {
      const raw = localStorage.getItem("jaw:passkey:authState");
      if (raw) {
        const state = JSON.parse(raw);
        if (state.isLoggedIn && state.credentialId) {
          // Find the stored account to get publicKey for silent restore
          const match = stored.find((a) => a.credentialId === state.credentialId);
          if (match?.publicKey) {
            silentRestore(state.credentialId, match.publicKey as `0x${string}`)
              .then((acc) => {
                setAccount(acc);
                setAddress(acc.address);
                setUsername(acc.getMetadata()?.username ?? "Wallet");
                registerWithServer(acc.address, acc.getMetadata()?.username ?? "Wallet");
              })
              .catch(() => {
                // Silent restore failed, user will need to sign in manually
              });
          }
        }
      }
    } catch {
      // ignore parse errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = useCallback(async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      const acc = await createAccount(name);
      setAccount(acc);
      setAddress(acc.address);
      setUsername(acc.getMetadata()?.username ?? name);
      await registerWithServer(acc.address, name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (credentialId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const acc = await restoreAccount(credentialId);
      const name = acc.getMetadata()?.username ?? "Wallet";
      setAccount(acc);
      setAddress(acc.address);
      setUsername(name);
      await registerWithServer(acc.address, name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to restore account");
    } finally {
      setLoading(false);
    }
  }, []);

  // Discover passkey from native OS picker (empty allowCredentials triggers iCloud Keychain / system picker)
  const discoverPasskey = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [], // Empty = show native passkey picker
          userVerification: "preferred",
          timeout: 60000,
        },
      }) as PublicKeyCredential | null;

      if (!credential) throw new Error("No passkey selected");

      // Convert rawId to base64url credentialId
      const rawId = new Uint8Array(credential.rawId);
      const base64 = btoa(String.fromCharCode(...rawId))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Try to find this credential in stored accounts
      const stored = getStoredAccounts();
      const match = stored.find((a) => a.credentialId === base64);

      if (match) {
        // Found in storage — restore directly (no second WebAuthn prompt)
        const acc = await silentRestore(base64, match.publicKey as `0x${string}`);
        const name = acc.getMetadata()?.username ?? "Wallet";
        setAccount(acc);
        setAddress(acc.address);
        setUsername(name);
        await registerWithServer(acc.address, name);
      } else {
        // Not in localStorage — try Account.get with the discovered credentialId
        // This will fail if the account isn't in JAW's storage, but it's worth trying
        const acc = await restoreAccount(base64);
        const name = acc.getMetadata()?.username ?? "Wallet";
        setAccount(acc);
        setAddress(acc.address);
        setUsername(name);
        await registerWithServer(acc.address, name);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to discover passkey");
    } finally {
      setLoading(false);
    }
  }, []);

  // Get a JAW account instance configured for Base Sepolia with paymaster
  const getTestnetAccount = useCallback(async (): Promise<Account | null> => {
    try {
      const raw = localStorage.getItem("jaw:passkey:authState");
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (!state.credentialId) return null;
      const stored = getStoredAccounts();
      const match = stored.find((a) => a.credentialId === state.credentialId);
      if (!match?.publicKey) return null;
      return restoreOnChain(state.credentialId, match.publicKey as `0x${string}`, BASE_SEPOLIA);
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(() => {
    jawLogout();
    setAccount(null);
    setAddress(null);
    setUsername(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{ account, address, username, loading, error, network, setNetwork, create, login, discoverPasskey, logout, getTestnetAccount, storedAccounts }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
