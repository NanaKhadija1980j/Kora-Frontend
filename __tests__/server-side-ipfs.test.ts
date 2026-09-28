import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadInvoicePDF, uploadInvoiceMetadata, uploadFileToPinata } from "@/lib/ipfs";
import { POST, DELETE } from "@/app/api/upload/route";
import { createMockUploadToken } from "@/lib/security";

describe("Server-Side IPFS Upload Migration Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. No PINATA_JWT exposed to client bundle ─────────────────────────────
  it("does not expose PINATA_JWT as a NEXT_PUBLIC_ client variable", () => {
    expect(process.env.NEXT_PUBLIC_PINATA_JWT).toBeUndefined();
  });

  // ─── 2. Auth Required on /api/upload ───────────────────────────────────────
  it("rejects POST /api/upload with 401 when Authorization header is missing", async () => {
    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ walletAddress: "GABC", metadata: {} }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Unauthorized");
  });

  it("rejects DELETE /api/upload with 401 when Authorization header is missing", async () => {
    const req = new Request("http://localhost/api/upload", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ cid: "QmTest123" }),
    });

    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("accepts valid Bearer upload token on /api/upload", async () => {
    const token = createMockUploadToken("GABC1234567890TESTADDRESS");
    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        walletAddress: "GABC1234567890TESTADDRESS",
        metadata: { invoiceNumber: "INV-100", amount: 1000 },
        name: "test-metadata",
      }),
    });

    // Mock fetch to Pinata API
    global.fetch = vi.fn().mockImplementation((url) => {
      if (typeof url === "string" && url.includes("pinJSONToIPFS")) {
        return Promise.resolve(
          new Response(JSON.stringify({ IpfsHash: "QmMockCid1234567890abcdefghijklmnopqrstuvwxyz12" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cid).toBe("QmMockCid1234567890abcdefghijklmnopqrstuvwxyz12");
  });

  // ─── 3. Progress Tracking via XHR ──────────────────────────────────────────
  it("executes uploadInvoicePDF with progress callback routing to /api/upload", async () => {
    const dummyFile = new File(["%PDF-1.4 dummy pdf content"], "invoice.pdf", {
      type: "application/pdf",
    });

    // Mock XMLHttpRequest
    const mockXhr = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      upload: { onprogress: null as any },
      send: vi.fn(function (this: any) {
        if (this.upload.onprogress) {
          this.upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 });
          this.upload.onprogress({ lengthComputable: true, loaded: 100, total: 100 });
        }
        this.status = 200;
        this.responseText = JSON.stringify({ cid: "QmMockCid1234567890abcdefghijklmnopqrstuvwxyz12" });
        if (this.onload) this.onload();
      }),
      status: 200,
      responseText: "",
      onload: null as any,
      onerror: null as any,
    };

    vi.stubGlobal("XMLHttpRequest", vi.fn(() => mockXhr));

    const progressSpy = vi.fn();
    const token = createMockUploadToken();

    const cid = await uploadInvoicePDF(dummyFile, "GABC1234567890TESTADDRESS", progressSpy, token);

    expect(cid).toBe("QmMockCid1234567890abcdefghijklmnopqrstuvwxyz12");
    expect(mockXhr.open).toHaveBeenCalledWith("POST", "/api/upload");
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith("Authorization", `Bearer ${token}`);
    expect(progressSpy).toHaveBeenCalledWith(50);
    expect(progressSpy).toHaveBeenCalledWith(100);
  });
});
