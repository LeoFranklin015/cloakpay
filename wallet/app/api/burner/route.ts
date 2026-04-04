import { NextRequest, NextResponse } from "next/server";
import { insertBurner, getActiveBurner } from "@/lib/db";
import {
  generatePrivateKey,
  privateKeyToAccount,
} from "viem/accounts";
import {
  createWalletClient,
  createPublicClient,
  http,
} from "viem";
import { base } from "viem/chains";

// POST: Create burner OR sign actions with burner key
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action ?? "create";

    if (action === "create") {
      return await handleCreate(body);
    } else if (action === "sign") {
      return await handleSign(body);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[burner] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Create a new mainnet burner wallet
async function handleCreate(body: { ownerAddress: string; token: string; amount: string }) {
  const { ownerAddress, token, amount } = body;

  const privateKey = generatePrivateKey();
  const burnerAccount = privateKeyToAccount(privateKey);

  await insertBurner(ownerAddress, burnerAccount.address, privateKey, "mainnet", token, amount);

  console.log("[burner:create] Address:", burnerAccount.address);

  return NextResponse.json({ burnerAddress: burnerAccount.address });
}

/**
 * Sign WC Pay actions with the burner's private key.
 */
async function handleSign(body: {
  ownerAddress: string;
  burnerAddress: string;
  actions: Array<{
    walletRpc: {
      chainId: string;
      method: string;
      params: string;
    };
  }>;
}) {
  const { ownerAddress, burnerAddress, actions } = body;

  // Get burner private key from DB
  const burner = await getActiveBurner(ownerAddress, "mainnet");
  if (!burner || burner.burner_address.toLowerCase() !== burnerAddress.toLowerCase()) {
    return NextResponse.json({ error: "Burner not found" }, { status: 404 });
  }

  const burnerKey = burner.private_key as `0x${string}`;
  const burnerAccount = privateKeyToAccount(burnerKey);

  const publicClient = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  const walletClient = createWalletClient({
    account: burnerAccount,
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  console.log("[burner:sign] Signing", actions.length, "actions with burner", burnerAccount.address);

  // Check if any action is eth_sendTransaction — burner needs ETH for gas
  const needsGas = actions.some((a) => {
    const { method } = a.walletRpc;
    return method === "eth_sendTransaction";
  });

  if (needsGas) {
    const ethBal = await publicClient.getBalance({ address: burnerAccount.address });
    if (ethBal < BigInt("10000000000000")) { // < 0.00001 ETH
      const mainnetKey = process.env.MAINNET_PRIVATE_KEY as `0x${string}` | undefined;
      if (mainnetKey) {
        console.log("[burner:sign] Funding burner with ETH for sendTransaction...");
        const fundingAccount = privateKeyToAccount(mainnetKey);
        const fundingWallet = createWalletClient({
          account: fundingAccount,
          chain: base,
          transport: http("https://mainnet.base.org"),
        });
        const fundTx = await fundingWallet.sendTransaction({
          to: burnerAccount.address,
          value: BigInt("30000000000000"), // 0.00003 ETH
        });
        await publicClient.waitForTransactionReceipt({ hash: fundTx });
        console.log("[burner:sign] Gas funded:", fundTx);
      } else {
        console.warn("[burner:sign] No MAINNET_PRIVATE_KEY — burner has no ETH for sendTransaction");
      }
    }
  }

  const signatures: string[] = [];

  for (const action of actions) {
    const { method, params } = action.walletRpc;
    const parsedParams = JSON.parse(params);

    let sig: string;

    switch (method) {
      case "eth_signTypedData_v4": {
        const typedData =
          typeof parsedParams[1] === "string"
            ? JSON.parse(parsedParams[1])
            : parsedParams[1];

        console.log("[burner:sign] eth_signTypedData_v4");
        sig = await burnerAccount.signTypedData({
          domain: typedData.domain,
          types: typedData.types,
          primaryType: typedData.primaryType,
          message: typedData.message,
        });
        break;
      }

      case "eth_sendTransaction": {
        const tx = parsedParams[0];
        console.log("[burner:sign] eth_sendTransaction to:", tx.to);

        const hash = await walletClient.sendTransaction({
          to: tx.to as `0x${string}`,
          value: tx.value ? BigInt(tx.value) : BigInt(0),
          data: tx.data as `0x${string}` | undefined,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        sig = hash;
        break;
      }

      case "personal_sign": {
        const message = parsedParams[0];
        console.log("[burner:sign] personal_sign");
        sig = await burnerAccount.signMessage({
          message: message.startsWith("0x")
            ? { raw: message as `0x${string}` }
            : message,
        });
        break;
      }

      default:
        throw new Error(`Unsupported RPC method: ${method}`);
    }

    signatures.push(sig);
  }

  console.log("[burner:sign] Signed", signatures.length, "actions successfully");
  return NextResponse.json({ signatures });
}

// GET: Get active burner for user
export async function GET(req: NextRequest) {
  const ownerAddress = req.nextUrl.searchParams.get("address");
  const network = req.nextUrl.searchParams.get("network") ?? "mainnet";
  if (!ownerAddress) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  const burner = await getActiveBurner(ownerAddress, network);
  if (!burner) {
    return NextResponse.json({ burner: null });
  }

  return NextResponse.json({
    burner: {
      address: burner.burner_address,
      status: burner.status,
      token: burner.token,
      amount: burner.amount,
    },
  });
}
