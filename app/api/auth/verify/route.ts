import { NextRequest, NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";
import { logger } from "@/lib/logger";
import { verifyCsrf } from "@/lib/csrf";
import { markWalletVerified } from "@/lib/verifiedSessions";
import { consumeNonce, nonceExists } from "../challenge/store";

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
 *
 * Replay protection:
 * - Extracts the nonce from the challenge string.
 * - Checks the nonce exists in the challenge store (was issued).
 * - Consumes the nonce (marks as used) to prevent replay.
 * - Returns specific error codes for expired, already-used, or unknown nonces.
 * - CSRF protection via double-submit cookie pattern.
 */
export async function POST(request: NextRequest): Promise<NextResponse<VerifyResponse>> {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError as NextResponse<VerifyResponse>;

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const body = (await request.json()) as VerifyRequest;
    const { challenge, signature, publicKey } = body;

    if (!challenge || !signature || !publicKey) {
      return NextResponse.json(
        {
          verified: false,
          expiresAt: 0,
          message: "Missing required fields: challenge, signature, publicKey",
        },
        { status: 400 }
      );
    }

    // Extract timestamp and nonce from challenge format:
    // "Kora Protocol authentication: {timestamp}:{nonce}"
    const challengeMatch = challenge.match(
      /^Kora Protocol authentication: (\d+):([a-f0-9]+)$/
    );
    if (!challengeMatch) {
      return NextResponse.json({
        verified: false,
        expiresAt: 0,
        message: "Invalid challenge format",
      });
    }

    const [, timestampStr, nonce] = challengeMatch;
    const challengeTimestamp = parseInt(timestampStr, 10);
    const now = Date.now();
    const CHALLENGE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

    // Verify challenge freshness
    if (now - challengeTimestamp > CHALLENGE_MAX_AGE) {
      return NextResponse.json({
        verified: false,
        expiresAt: 0,
        message: "Challenge expired",
      });
    }

    // Replay protection: check nonce was issued and hasn't been used
    if (!nonceExists(nonce)) {
      logger.warn("Verification attempt with unknown nonce", { requestId, route: "/api/auth/verify" });
      return NextResponse.json({
        verified: false,
        expiresAt: 0,
        message: "Challenge nonce not found. Please request a new challenge.",
      });
    }

    if (!consumeNonce(nonce)) {
      logger.warn("Replay attack detected: nonce already used", { requestId, route: "/api/auth/verify" });
      return NextResponse.json({
        verified: false,
        expiresAt: 0,
        message: "Challenge already used. Please request a new challenge.",
      });
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
        });
      }

      // Verification successful - session valid for 1 hour
      const SESSION_DURATION = 60 * 60 * 1000;
      const expiresAt = now + SESSION_DURATION;

      markWalletVerified(publicKey, expiresAt);

      return NextResponse.json({ verified: true, expiresAt });
    } catch (verifyError) {
      logger.error("Verification error", { requestId, route: "/api/auth/verify", error: verifyError });
      return NextResponse.json({
        verified: false,
        expiresAt: 0,
        message: "Failed to verify signature",
      });
    }
  } catch (error) {
    logger.error("Error processing verify request", { requestId, route: "/api/auth/verify", error });
    return NextResponse.json(
      { verified: false, expiresAt: 0, message: "Internal server error" },
      { status: 500 }
    );
  }
}