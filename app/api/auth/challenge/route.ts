import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { logger } from "@/lib/logger";
import { verifyCsrf } from "@/lib/csrf";

interface ChallengeResponse {
  challenge: string;
  timestamp: number;
}

/**
 * POST /api/auth/challenge
 * Generates a server-side nonce challenge for wallet ownership verification.
 * The client will sign this challenge with their private key.
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const csrfError = verifyCsrf(_request);
  if (csrfError) return csrfError;

  const requestId = _request.headers.get("x-request-id") ?? crypto.randomUUID();
  const route = "/api/auth/challenge";
  try {
    const nonce = randomBytes(32).toString("hex");
    const timestamp = Date.now();
    // Format required by spec: prevents replay attacks via embedded timestamp + unique nonce
    const challenge = `Kora Protocol authentication: ${timestamp}:${nonce}`;

    return NextResponse.json<ChallengeResponse>({ challenge, timestamp });
  } catch (error) {
    logger.error("Error generating challenge", { requestId, route, error });
    return NextResponse.json({ error: "Failed to generate challenge", requestId }, { status: 500 });
  }
}
