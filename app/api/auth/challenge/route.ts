import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyCsrf } from "@/lib/csrf";
import { generateNonceChallenge, type ChallengeResponse } from "./store";

/**
 * POST /api/auth/challenge
 * Generates a server-side nonce challenge for wallet ownership verification.
 * The client will sign this challenge with their private key.
 *
 * Replay protection:
 * - Each nonce is stored server-side and marked as used on verification.
 * - Nonces expire after 10 minutes.
 * - The verify endpoint checks and invalidates the nonce after use.
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const csrfError = verifyCsrf(_request);
  if (csrfError) return csrfError;

  const requestId = _request.headers.get("x-request-id") ?? crypto.randomUUID();
  const route = "/api/auth/challenge";
  try {
    const data = generateNonceChallenge();
    return NextResponse.json<ChallengeResponse>(data);
  } catch (error) {
    logger.error("Error generating challenge", { requestId, route, error });
    return NextResponse.json({ error: "Failed to generate challenge", requestId }, { status: 500 });
  }
}