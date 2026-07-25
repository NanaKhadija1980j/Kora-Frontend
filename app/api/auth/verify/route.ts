import { NextRequest, NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";
import { logger } from "@/lib/logger";
import { verifyCsrf } from "@/lib/csrf";

interface VerifyRequest {
  challenge: string;
  signature: string;
  publicKey: string;
}

interface VerifyResponse {
  verified: boolean;
  expiresAt: number;
  message?: string;
}

/**
 * POST /api/auth/verify
 * Verifies that a signature is valid for the given challenge and public key.
 * Uses Stellar SDK to verify the signature.
 */
export async function POST(request: NextRequest): Promise<NextResponse<VerifyResponse>> {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError as NextResponse<VerifyResponse>;

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const body = await request.json() as VerifyRequest;
    const { challenge, signature, publicKey } = body;

    // Validate inputs
    if (!challenge || !signature || !publicKey) {
      return NextResponse.json(
        {
          verified: false,
          expiresAt: 0,
          message: "Missing required fields: challenge, signature, publicKey",
          requestId,
        },
        { status: 400 }
      );
    }

    // Verify the signature using Stellar SDK's Keypair
    try {
      const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);
      const valid = keypair.verify(
        Buffer.from(challenge, "utf-8"),
        Buffer.from(signature, "base64")
      );

      if (!valid) {
        return NextResponse.json({
          verified: false,
          expiresAt: 0,
          message: "Signature verification failed",
          requestId,
        });
      }

      // Extract timestamp from challenge format: "Kora Protocol authentication: {timestamp}:{nonce}"
      const timestampMatch = challenge.match(/^Kora Protocol authentication: (\d+):/);
      if (!timestampMatch) {
        return NextResponse.json({
          verified: false,
          expiresAt: 0,
          message: "Invalid challenge format",
          requestId,
        });
      }

      const challengeTimestamp = parseInt(timestampMatch[1], 10);
      const now = Date.now();
      const CHALLENGE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

      // Verify challenge freshness
      if (now - challengeTimestamp > CHALLENGE_MAX_AGE) {
        return NextResponse.json({
          verified: false,
          expiresAt: 0,
          message: "Challenge expired",
          requestId,
        });
      }

      // Verification successful - session valid for 1 hour
      const SESSION_DURATION = 60 * 60 * 1000; // 1 hour
      const expiresAt = now + SESSION_DURATION;

      return NextResponse.json({ verified: true, expiresAt });
    } catch (verifyError) {
      logger.error("Verification error", { requestId, route: "/api/auth/verify", error: verifyError });
      return NextResponse.json({
        verified: false,
        expiresAt: 0,
        message: "Failed to verify signature",
        requestId,
      });
    }
  } catch (error) {
    logger.error("Error processing verify request", { requestId, route: "/api/auth/verify", error });
    return NextResponse.json(
      { verified: false, expiresAt: 0, message: "Internal server error", requestId },
      { status: 500 }
    );
  }
}
