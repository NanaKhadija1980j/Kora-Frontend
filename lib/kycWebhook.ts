/**
 * Synaps KYC webhook parsing and signature verification — Issue #694.
 *
 * Kept separate from the route handler and deliberately pure: the route owns
 * HTTP concerns, this owns "is this payload real, and what does it mean". That
 * split is what makes the malformed-payload and signature cases testable
 * without constructing a Request for each one.
 *
 * Reference: https://docs.synaps.io/webhooks
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** Local KYC state, mirroring `walletStore.kycStatus`. */
export type KycStatus = "none" | "pending" | "verified" | "rejected";

export const SYNAPS_SIGNATURE_HEADER = "x-synaps-signature";

/**
 * Synaps session states we act on. Unknown states are still accepted — Synaps
 * adds them over time — and map to `none` rather than 400, so a new state never
 * makes the endpoint start rejecting legitimate callbacks.
 */
const SYNAPS_STATUS_MAP: Record<string, KycStatus> = {
  APPROVED: "verified",
  VERIFIED: "verified",
  REJECTED: "rejected",
  CANCELLED: "rejected",
  SUBMITTED: "pending",
  PENDING: "pending",
  PROCESSING: "pending",
  RESET: "none",
};

/**
 * A Stellar public key. The webhook's `alias` carries the wallet address the
 * investor started the session with; anything else cannot be keyed to a
 * local wallet and is rejected rather than silently stored.
 */
const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

export const synapsWebhookSchema = z
  .object({
    /** Synaps event name, e.g. "identity.verified". */
    event: z.string().min(1).max(200),
    /** Synaps session identifier. */
    session_id: z.string().min(1).max(200).optional(),
    /** Legacy/alternate identifier used by some Synaps tenants. */
    user_id: z.string().min(1).max(200).optional(),
    /** Session state. Free-form so new Synaps states do not 400. */
    status: z.string().min(1).max(64),
    /** Wallet address supplied when the session was created. */
    alias: z.string().min(1).max(200).optional(),
  })
  .strip()
  .refine((body) => Boolean(body.session_id || body.user_id), {
    message: "Either session_id or user_id is required",
  });

export type SynapsWebhookPayload = z.infer<typeof synapsWebhookSchema>;

export interface ParsedKycEvent {
  event: string;
  sessionId: string;
  /** Wallet address this event resolves to, or null when it keys to nothing local. */
  walletAddress: string | null;
  /** Raw Synaps status, upper-cased. */
  synapsStatus: string;
  kycStatus: KycStatus;
}

export type ParseResult =
  | { ok: true; value: ParsedKycEvent }
  | { ok: false; error: string };

/** Map a Synaps session state onto the local KYC status. */
export function mapSynapsStatus(status: string): KycStatus {
  return SYNAPS_STATUS_MAP[String(status).trim().toUpperCase()] ?? "none";
}

export function isStellarAddress(value: unknown): value is string {
  return typeof value === "string" && STELLAR_ADDRESS.test(value);
}

/**
 * Validate an incoming webhook body and reduce it to the facts the route acts
 * on. Returns a discriminated result rather than throwing so the route can map
 * failure straight onto a 400 without a try/catch around business logic.
 */
export function parseSynapsWebhook(body: unknown): ParseResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Webhook body must be a JSON object" };
  }

  const parsed = synapsWebhookSchema.safeParse(body);
  if (!parsed.success) {
    // Zod messages name the offending field but never echo its value, so this
    // stays safe to return to the caller.
    const issue = parsed.error.issues[0];
    const path = issue.path.join(".");
    return { ok: false, error: path ? `${path}: ${issue.message}` : issue.message };
  }

  const value = parsed.data;
  const alias = value.alias;

  return {
    ok: true,
    value: {
      event: value.event,
      sessionId: (value.session_id ?? value.user_id)!,
      walletAddress: isStellarAddress(alias) ? alias : null,
      synapsStatus: value.status.trim().toUpperCase(),
      kycStatus: mapSynapsStatus(value.status),
    },
  };
}

/**
 * Constant-time comparison of the Synaps signature header against an HMAC of
 * the raw body.
 *
 * When no secret is configured the header is still required but cannot be
 * checked — that is the mock/dev posture the KYC modal runs in. It is reported
 * as `"unverified"` rather than `true` so the route can log the difference
 * without pretending the callback was authenticated.
 */
export type SignatureResult = "valid" | "invalid" | "missing" | "unverified";

export function verifySynapsSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined
): SignatureResult {
  if (!signature) return "missing";
  if (!secret) return "unverified";

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  // Synaps sends lowercase hex; normalise before comparing so casing alone is
  // not treated as a forged signature.
  const provided = signature.trim().toLowerCase().replace(/^sha256=/, "");

  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  // timingSafeEqual throws on a length mismatch, which is itself a leak-free
  // rejection — a wrong-length signature cannot be right.
  if (expectedBuf.length !== providedBuf.length) return "invalid";

  return timingSafeEqual(expectedBuf, providedBuf) ? "valid" : "invalid";
}
