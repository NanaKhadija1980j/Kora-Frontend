/**
 * Map raw Soroban simulation / contract errors to user-facing messages.
 * Kept free of RPC/env imports so unit tests can load it safely.
 */

const SOROBAN_ERROR_CODES: Record<number, string> = {
  1: "Invoice not found",
  2: "Invoice already funded",
  3: "Insufficient balance",
  4: "Unauthorized: caller is not the owner",
  5: "Invoice has already been repaid",
  6: "Funding amount exceeds remaining capacity",
  7: "Invoice is not in a fundable state",
  8: "Repayment amount is incorrect",
};

/** Alias used by tx simulation preview paths (#385). */
export function mapSimulationError(error: string): string {
  return parseSorobanError(error);
}

export function parseSorobanError(error: string): string {
  const match = error.match(/#(\d+)/);
  if (match) {
    const code = parseInt(match[1], 10);
    return SOROBAN_ERROR_CODES[code] ?? `Contract error #${code}`;
  }
  return error;
}
