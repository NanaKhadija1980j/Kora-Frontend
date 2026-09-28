/**
 * Synaps KYC webhook route — Issue #694.
 *
 * Covers the three delivery outcomes Synaps actually produces (approved,
 * rejected, pending), the malformed cases that must 400 rather than be
 * half-applied, signature handling, and the guarantee that nothing from the
 * webhook body reaches the logs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";

import { GET, POST } from "../route";
import { clearKycStatuses, getKycStatus } from "@/lib/kycSessions";
import { SYNAPS_SIGNATURE_HEADER } from "@/lib/kycWebhook";

const WALLET = "GBQXFQ2PVCFP2LOJ3XPMBLM5R2LSCVJKGHGXAWWVQCLDWKZVKKPFDANJ";
const OTHER_WALLET = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";
const SECRET = "synaps-test-secret";

function sign(body: string, secret = SECRET) {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function post(
  body: unknown,
  opts: { signature?: string | null; raw?: string } = {}
): NextRequest {
  const raw = opts.raw ?? JSON.stringify(body);
  const headers = new Headers({ "content-type": "application/json" });
  const signature =
    opts.signature === undefined ? "mock-signature" : opts.signature;
  if (signature !== null) headers.set(SYNAPS_SIGNATURE_HEADER, signature);

  return new NextRequest("http://localhost/api/webhooks/kyc", {
    method: "POST",
    headers,
    body: raw,
  });
}

function get(address: string | null): NextRequest {
  const url = new URL("http://localhost/api/webhooks/kyc");
  if (address !== null) url.searchParams.set("address", address);
  return new NextRequest(url, { method: "GET" });
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    event: "identity.verified",
    session_id: "sess_123",
    status: "APPROVED",
    alias: WALLET,
    ...overrides,
  };
}

beforeEach(() => {
  clearKycStatuses();
  delete process.env.SYNAPS_WEBHOOK_SECRET;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SYNAPS_WEBHOOK_SECRET;
});

describe("POST /api/webhooks/kyc — approved", () => {
  it("returns 200 and reports the mapped status", async () => {
    const res = await POST(post(event()));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: { kycStatus: "verified", applied: true },
    });
  });

  it("persists verified against the wallet address", async () => {
    await POST(post(event()));

    expect(getKycStatus(WALLET)).toMatchObject({
      status: "verified",
      sessionId: "sess_123",
    });
  });

  it("makes the new status readable over GET without a reload", async () => {
    await POST(post(event()));
    const res = await GET(get(WALLET));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { kycStatus: "verified" },
    });
  });

  it("also accepts VERIFIED as an approved state", async () => {
    await POST(post(event({ status: "VERIFIED" })));
    expect(getKycStatus(WALLET)?.status).toBe("verified");
  });

  it("is case- and whitespace-insensitive about the status", async () => {
    await POST(post(event({ status: "  approved  " })));
    expect(getKycStatus(WALLET)?.status).toBe("verified");
  });

  it("does not touch an unrelated wallet", async () => {
    await POST(post(event()));
    expect(getKycStatus(OTHER_WALLET)).toBeNull();
  });

  it("falls back to user_id when session_id is absent", async () => {
    await POST(post(event({ session_id: undefined, user_id: "user_9" })));
    expect(getKycStatus(WALLET)).toMatchObject({ sessionId: "user_9" });
  });
});

describe("POST /api/webhooks/kyc — rejected and pending", () => {
  it("records a rejection", async () => {
    const res = await POST(
      post(event({ event: "identity.rejected", status: "REJECTED" }))
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { kycStatus: "rejected" },
    });
    expect(getKycStatus(WALLET)?.status).toBe("rejected");
  });

  it("treats a cancelled session as rejected", async () => {
    await POST(post(event({ status: "CANCELLED" })));
    expect(getKycStatus(WALLET)?.status).toBe("rejected");
  });

  it("records SUBMITTED as pending", async () => {
    await POST(post(event({ event: "identity.submitted", status: "SUBMITTED" })));
    expect(getKycStatus(WALLET)?.status).toBe("pending");
  });

  it("records PENDING and PROCESSING as pending", async () => {
    await POST(post(event({ status: "PENDING" })));
    expect(getKycStatus(WALLET)?.status).toBe("pending");

    clearKycStatuses();
    await POST(post(event({ status: "PROCESSING" })));
    expect(getKycStatus(WALLET)?.status).toBe("pending");
  });

  it("lets a later approval supersede an earlier pending", async () => {
    await POST(post(event({ status: "SUBMITTED" })));
    await POST(post(event({ status: "APPROVED" })));

    expect(getKycStatus(WALLET)?.status).toBe("verified");
  });

  it("accepts an unrecognised Synaps state as 'none' rather than rejecting it", async () => {
    // Synaps adds states over time; a new one must not start 400-ing the endpoint.
    const res = await POST(post(event({ status: "SOME_FUTURE_STATE" })));

    expect(res.status).toBe(200);
    expect(getKycStatus(WALLET)?.status).toBe("none");
  });

  it("accepts an event with no resolvable wallet without persisting anything", async () => {
    const res = await POST(post(event({ alias: "not-a-stellar-address" })));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { applied: false } });
    expect(getKycStatus(WALLET)).toBeNull();
  });
});

describe("POST /api/webhooks/kyc — malformed payloads", () => {
  it("returns 400 for a body that is not JSON", async () => {
    const res = await POST(post(undefined, { raw: "not json at all" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ success: false });
  });

  it("returns 400 for a JSON array", async () => {
    expect((await POST(post([{ event: "x", status: "APPROVED" }]))).status).toBe(400);
  });

  it("returns 400 for a JSON primitive", async () => {
    expect((await POST(post(undefined, { raw: '"just-a-string"' }))).status).toBe(400);
  });

  it("returns 400 for null", async () => {
    expect((await POST(post(undefined, { raw: "null" }))).status).toBe(400);
  });

  it("returns 400 when event is missing", async () => {
    expect((await POST(post(event({ event: undefined }))).then((r) => r.status))).toBe(
      400
    );
  });

  it("returns 400 when status is missing", async () => {
    expect((await POST(post(event({ status: undefined }))).then((r) => r.status))).toBe(
      400
    );
  });

  it("returns 400 when both session_id and user_id are missing", async () => {
    const res = await POST(post(event({ session_id: undefined, user_id: undefined })));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a field has the wrong type", async () => {
    expect((await POST(post(event({ status: 42 })))).status).toBe(400);
  });

  it("returns 400 for an empty body", async () => {
    expect((await POST(post(undefined, { raw: "" }))).status).toBe(400);
  });

  it("persists nothing when the payload is rejected", async () => {
    await POST(post(event({ status: undefined })));
    expect(getKycStatus(WALLET)).toBeNull();
  });

  it("does not overwrite an existing status with a malformed retry", async () => {
    await POST(post(event()));
    await POST(post(undefined, { raw: "{oops" }));

    expect(getKycStatus(WALLET)?.status).toBe("verified");
  });
});

describe("POST /api/webhooks/kyc — signature", () => {
  it("returns 401 when the signature header is absent", async () => {
    const res = await POST(post(event(), { signature: null }));

    expect(res.status).toBe(401);
    expect(getKycStatus(WALLET)).toBeNull();
  });

  it("accepts a correct HMAC when a secret is configured", async () => {
    process.env.SYNAPS_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify(event());

    const res = await POST(post(undefined, { raw, signature: sign(raw) }));

    expect(res.status).toBe(200);
    expect(getKycStatus(WALLET)?.status).toBe("verified");
  });

  it("accepts the sha256= prefixed form", async () => {
    process.env.SYNAPS_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify(event());

    const res = await POST(post(undefined, { raw, signature: `sha256=${sign(raw)}` }));
    expect(res.status).toBe(200);
  });

  it("returns 401 for an HMAC computed with the wrong secret", async () => {
    process.env.SYNAPS_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify(event());

    const res = await POST(post(undefined, { raw, signature: sign(raw, "wrong") }));

    expect(res.status).toBe(401);
    expect(getKycStatus(WALLET)).toBeNull();
  });

  it("returns 401 when the body was tampered with after signing", async () => {
    process.env.SYNAPS_WEBHOOK_SECRET = SECRET;
    const signed = JSON.stringify(event({ status: "REJECTED" }));
    const tampered = JSON.stringify(event({ status: "APPROVED" }));

    const res = await POST(post(undefined, { raw: tampered, signature: sign(signed) }));

    expect(res.status).toBe(401);
    expect(getKycStatus(WALLET)).toBeNull();
  });

  it("returns 401 for a signature of the wrong length", async () => {
    process.env.SYNAPS_WEBHOOK_SECRET = SECRET;
    const raw = JSON.stringify(event());

    expect((await POST(post(undefined, { raw, signature: "abc" }))).status).toBe(401);
  });
});

describe("POST /api/webhooks/kyc — logging", () => {
  it("never writes the webhook body or signature to the console", async () => {
    process.env.SYNAPS_WEBHOOK_SECRET = SECRET;
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {})
    );

    const body = event({ alias: WALLET, session_id: "sess_secret_987" });
    const raw = JSON.stringify(body);
    await POST(post(undefined, { raw, signature: sign(raw) }));

    const written = spies
      .flatMap((spy) => spy.mock.calls)
      .flat()
      .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
      .join("\n");

    expect(written).not.toContain(raw);
    expect(written).not.toContain(SECRET);
    expect(written).not.toContain(sign(raw));
    expect(written).not.toContain(WALLET);
  });

  it("does not log the signature when rejecting a bad one", async () => {
    process.env.SYNAPS_WEBHOOK_SECRET = SECRET;
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {})
    );

    const forged = sign(JSON.stringify(event()), "attacker");
    await POST(post(event(), { signature: forged }));

    const written = spies
      .flatMap((spy) => spy.mock.calls)
      .flat()
      .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
      .join("\n");

    expect(written).not.toContain(forged);
  });
});

describe("GET /api/webhooks/kyc", () => {
  it("returns 'none' for a wallet with no webhook history", async () => {
    const res = await GET(get(WALLET));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: { kycStatus: "none", updatedAt: null },
    });
  });

  it("returns 400 when the address is absent", async () => {
    expect((await GET(get(null))).status).toBe(400);
  });

  it("returns 400 for a malformed address", async () => {
    expect((await GET(get("not-a-wallet"))).status).toBe(400);
  });

  it("returns 400 for a contract address rather than an account", async () => {
    expect(
      (await GET(get("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4"))).status
    ).toBe(400);
  });

  it("reports the timestamp of the recorded transition", async () => {
    await POST(post(event()));
    const body = await (await GET(get(WALLET))).json();

    expect(typeof body.data.updatedAt).toBe("number");
    expect(body.data.updatedAt).toBeLessThanOrEqual(Date.now());
  });
});
