/**
 * Opt-in nightly testnet E2E — mint, fund, repay against real contracts.
 *
 * Unlike the rest of the e2e/ suite (mock wallet, mock data), this spec
 * talks to the live Soroban testnet contracts using a funded keypair, the
 * same way scripts/seed-testnet.ts does. It is intentionally NOT part of
 * the default `npm run test:e2e` / CI `test.yml` run:
 *
 *   - It is skipped unless RUN_TESTNET_E2E=true is set.
 *   - It requires TESTNET_E2E_SECRET_KEY (a funded testnet account) and
 *     NEXT_PUBLIC_STELLAR_NETWORK=testnet.
 *
 * See .github/workflows/nightly-testnet-e2e.yml for the scheduled runner
 * that opts in and provides these secrets.
 */
import { test, expect } from "@playwright/test";

const RUN_TESTNET_E2E = process.env.RUN_TESTNET_E2E === "true";
const SECRET_KEY = process.env.TESTNET_E2E_SECRET_KEY;

test.describe("Testnet — mint, fund, repay (real contracts)", () => {
  test.skip(
    !RUN_TESTNET_E2E,
    "Opt-in nightly-only suite. Set RUN_TESTNET_E2E=true to run against live testnet contracts."
  );

  test("mints, funds, and repays a real invoice on testnet", async () => {
    expect(
      SECRET_KEY,
      "TESTNET_E2E_SECRET_KEY must be set (funded testnet keypair) when RUN_TESTNET_E2E=true"
    ).toBeTruthy();

    const { env } = await import("@/lib/env");
    expect(env.NEXT_PUBLIC_STELLAR_NETWORK).toBe("testnet");

    const StellarSdk = await import("@stellar/stellar-sdk");
    const { fundTestnetAccount, submitTransaction, waitForTransaction } = await import(
      "@/lib/stellar/client"
    );
    const { invoiceContract, marketplaceContract, buildTestnetUsdcMintTx } = await import(
      "@/lib/stellar/contracts"
    );

    const owner = StellarSdk.Keypair.fromSecret(SECRET_KEY!);
    await fundTestnetAccount(owner.publicKey());

    const usdcMintXdr = await buildTestnetUsdcMintTx(owner.publicKey(), 1_000_000_000n);
    const signedUsdcMint = await signWithKeypair(StellarSdk, usdcMintXdr, owner);
    const usdcResult = await submitTransaction(signedUsdcMint);
    await waitForTransaction(usdcResult.hash);

    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
    const mintXdr = await invoiceContract.mintInvoice(
      {
        ipfsCid: "QmNightlyTestnetE2EPlaceholder",
        amount: 1_000_000_000n,
        financingAmount: 900_000_000n,
        discountRate: 1000,
        dueDate,
      },
      owner.publicKey()
    );
    const signedMint = await signWithKeypair(StellarSdk, mintXdr, owner);
    const mintResult = await submitTransaction(signedMint);
    const mintConfirmation = await waitForTransaction(mintResult.hash);
    expect(mintConfirmation.status).toBe("SUCCESS");

    const onChainInvoice = await invoiceContract.getInvoice(
      /* tokenId */ 0n,
      owner.publicKey()
    );
    expect(onChainInvoice).toBeTruthy();

    const fundXdr = await marketplaceContract.fundInvoice(
      { tokenId: 0n, amount: 900_000_000n },
      owner.publicKey()
    );
    const signedFund = await signWithKeypair(StellarSdk, fundXdr, owner);
    const fundResult = await submitTransaction(signedFund);
    const fundConfirmation = await waitForTransaction(fundResult.hash);
    expect(fundConfirmation.status).toBe("SUCCESS");

    const repayXdr = await marketplaceContract.repayInvoice(
      { tokenId: 0n },
      owner.publicKey()
    );
    const signedRepay = await signWithKeypair(StellarSdk, repayXdr, owner);
    const repayResult = await submitTransaction(signedRepay);
    const repayConfirmation = await waitForTransaction(repayResult.hash);
    expect(repayConfirmation.status).toBe("SUCCESS");
  });
});

async function signWithKeypair(
  StellarSdk: typeof import("@stellar/stellar-sdk"),
  unsignedXdr: string,
  keypair: InstanceType<typeof StellarSdk.Keypair>
): Promise<string> {
  const { env } = await import("@/lib/env");
  const tx = StellarSdk.TransactionBuilder.fromXDR(
    unsignedXdr,
    env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE
  );
  tx.sign(keypair);
  return tx.toXDR();
}
