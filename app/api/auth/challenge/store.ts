import { randomBytes } from "crypto";

export interface ChallengeResponse {
  challenge: string;
  timestamp: number;
  nonce: string;
}

const nonceStore = new Map<string, { used: boolean; createdAt: number }>();
const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function evictStaleNonces(): void {
  const now = Date.now();
  for (const [key, entry] of nonceStore) {
    if (now - entry.createdAt > NONCE_TTL_MS) {
      nonceStore.delete(key);
    }
  }
}

export function generateNonceChallenge(): ChallengeResponse {
  evictStaleNonces();
  const nonce = randomBytes(32).toString("hex");
  const timestamp = Date.now();
  const challenge = `Kora Protocol authentication: ${timestamp}:${nonce}`;
  nonceStore.set(nonce, { used: false, createdAt: timestamp });
  return { challenge, timestamp, nonce };
}

export function consumeNonce(nonce: string): boolean {
  const entry = nonceStore.get(nonce);
  if (!entry || entry.used) return false;
  entry.used = true;
  return true;
}

export function nonceExists(nonce: string): boolean {
  return nonceStore.has(nonce);
}
