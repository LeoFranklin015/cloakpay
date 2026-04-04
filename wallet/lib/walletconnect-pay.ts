import { WalletConnectPay } from "@walletconnect/pay";

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

let client: InstanceType<typeof WalletConnectPay> | null = null;

export function getPayClient(): InstanceType<typeof WalletConnectPay> {
  if (!client) {
    client = new WalletConnectPay({
      appId: PROJECT_ID,
    });
  }
  return client;
}
