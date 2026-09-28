/**
 * Client-side helper for the VirusTotal scan-before-pin upload flow.
 *
 * The /api/upload route runs a VirusTotal scan before pinning to IPFS and
 * responds with `{ error: "Virus scan failed: ..." }` + 400 when a file is
 * rejected. This module turns that raw error string into a user-facing
 * reason so upload UIs can surface *why* a file was blocked instead of a
 * generic failure message.
 */

export interface UploadRejection {
  rejected: boolean;
  reason: string;
  stats?: Record<string, number>;
}

const SCAN_PREFIX = "Virus scan failed:";

/**
 * Parses an upload API error response body and extracts a human-readable
 * rejection reason when the failure came from the VirusTotal scan step.
 */
export function parseUploadRejection(body: { error?: string } | null | undefined): UploadRejection {
  const error = body?.error ?? "";

  if (!error.startsWith(SCAN_PREFIX)) {
    return { rejected: false, reason: "" };
  }

  const detail = error.slice(SCAN_PREFIX.length).trim();

  // Detail may be a JSON-stringified stats object (e.g. {"malicious":2,"suspicious":1})
  try {
    const parsed = JSON.parse(detail);
    if (parsed && typeof parsed === "object") {
      const malicious = Number(parsed.malicious ?? 0);
      const suspicious = Number(parsed.suspicious ?? 0);
      return {
        rejected: true,
        reason: `This file was flagged by ${malicious + suspicious} security vendor(s) and cannot be uploaded.`,
        stats: parsed,
      };
    }
  } catch {
    // Not JSON — fall through to using the raw detail string.
  }

  return {
    rejected: true,
    reason: detail || "This file failed our security scan and cannot be uploaded.",
  };
}
