import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { getKycStatus, setKycStatus } from "@/lib/kycSessions";
import {
  SYNAPS_SIGNATURE_HEADER,
  isStellarAddress,
  parseSynapsWebhook,
  verifySynapsSignature,
} from "@/lib/kycWebhook";

/**
 * Synaps KYC webhook — Issue #694.
 *
 * POST /api/webhooks/kyc
 *   Receives Synaps session callbacks, verifies the signature, validates the
 *   payload, and persists the resulting KYC status against the investor's
 *   wallet address.
 *
 * GET /api/webhooks/kyc?address=G...
 *   Returns the stored status so the client can refresh the wallet KYC tab
 *   without a full page reload.
 *
 * Logging: the webhook body is never logged. Synaps payloads carry identity
 * material, and the signature header is a shared-secret MAC — only the derived,
 * non-identifying facts (event name, mapped status, signature outcome) are
 * recorded.
 *
 * Reference: https://docs.synaps.io/webhooks
 */

const ROUTE = "/api/webhooks/kyc";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  // Read the body as text first: the HMAC is over the exact bytes Synaps sent,
  // so re-serialising a parsed object would change the signature.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to read request body", requestId },
      { status: 400 }
    );
  }

  const signature = request.headers.get(SYNAPS_SIGNATURE_HEADER);
  const signatureResult = verifySynapsSignature(
    rawBody,
    signature,
    process.env.SYNAPS_WEBHOOK_SECRET
  );

  if (signatureResult === "missing") {
    return NextResponse.json(
      { success: false, message: "Missing webhook signature", requestId },
      { status: 401 }
    );
  }
  if (signatureResult === "invalid") {
    logger.warn("Synaps webhook signature rejected", { requestId, route: ROUTE });
    return NextResponse.json(
      { success: false, message: "Invalid webhook signature", requestId },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { success: false, message: "Malformed JSON payload", requestId },
      { status: 400 }
    );
  }

  const parsed = parseSynapsWebhook(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, message: `Invalid webhook payload: ${parsed.error}`, requestId },
      { status: 400 }
    );
  }

  const { event, sessionId, walletAddress, synapsStatus, kycStatus } = parsed.value;

  // A session with no resolvable wallet is accepted (Synaps must not retry a
  // payload we will never accept) but there is nothing local to update.
  if (!walletAddress) {
    logger.warn("Synaps webhook has no resolvable wallet alias", {
      requestId,
      route: ROUTE,
      event,
      synapsStatus,
    });
    return NextResponse.json({
      success: true,
      message: "Event accepted but no wallet alias to update",
      data: { event, kycStatus, applied: false },
    });
  }

  const record = setKycStatus(walletAddress, kycStatus, sessionId);

  logger.info("Synaps webhook applied", {
    requestId,
    route: ROUTE,
    event,
    synapsStatus,
    kycStatus: record.status,
  });

  return NextResponse.json({
    success: true,
    message: "Webhook processed successfully",
    data: {
      event,
      kycStatus: record.status,
      updatedAt: record.updatedAt,
      applied: record.status === kycStatus,
    },
  });
}

/**
 * Current KYC status for a wallet.
 *
 * Returns `none` for an address with no record rather than 404: "we have never
 * seen a verification for you" is a status, not an error, and the poller would
 * otherwise have to treat its normal steady state as a failure.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const address = request.nextUrl.searchParams.get("address");

  if (!isStellarAddress(address)) {
    return NextResponse.json(
      { success: false, message: "A valid Stellar address is required" },
      { status: 400 }
    );
  }

  const record = getKycStatus(address);

  return NextResponse.json({
    success: true,
    data: {
      kycStatus: record?.status ?? "none",
      updatedAt: record?.updatedAt ?? null,
    },
  });
}
