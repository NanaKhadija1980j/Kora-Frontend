import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkPinataHealth,
  invalidatePinataHealthCache,
  isValidCID,
  validateCid,
  InvalidCIDError,
  MAX_FILE_SIZE,
  FileSizeError,
  uploadInvoicePDF,
  uploadInvoiceMetadata,
  uploadInvoiceToIPFS,
  uploadValidatedInvoiceMetadata,
  unpinFromPinata,
  unpinMultipleFromPinata,
  uploadFileToPinata,
  uploadJsonToPinata,
} from "../ipfs";

// Mock the env module to return a stable gateway URL
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_IPFS_GATEWAY: "https://gateway.pinata.cloud/ipfs",
  },
}));

// Mock invoiceSvg to avoid generating real SVGs in tests
vi.mock("@/lib/invoiceSvg", () => ({
  generateInvoiceSvg: vi.fn(() => "<svg>mock</svg>"),
  svgToFile: vi.fn((svg, name) => new File([svg], name, { type: "image/svg+xml" })),
}));

// Mock invoiceMetadata to isolate IPFS upload unit tests from validation details
vi.mock("@/lib/invoiceMetadata", () => ({
  validateInvoiceMetadata: vi.fn(() => ({ success: true, errors: [] })),
  buildInvoiceMetadata: vi.fn((input) => ({
    ...input,
    metadata_version: 1,
  })),
  METADATA_VERSION: 1,
}));

describe("IPFS Upload Service", () => {
  let mockXhr: any;
  const mockFetch = vi.fn();

  beforeEach(() => {
    // Reset fetch mock
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);

    // Set up XMLHttpRequest mock
    mockXhr = {
      open: vi.fn(),
      send: vi.fn(function (this: any) {
        // Default to immediate success
        this.onload();
      }),
      upload: {
        onprogress: null as any,
      },
      onload: null as any,
      onerror: null as any,
      status: 200,
      statusText: "OK",
      responseText: JSON.stringify({ IpfsHash: "QmPDFCid1234567890" }),
    };

    vi.stubGlobal("XMLHttpRequest", vi.fn(() => mockXhr));
    invalidatePinataHealthCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ─── 1. CID Validation Tests ──────────────────────────────────────────────

  describe("CID Validation", () => {
    it("should return true for valid CIDv0", () => {
      expect(isValidCID("QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco")).toBe(true);
    });

    it("should return true for valid CIDv1", () => {
      expect(isValidCID("bafybeicg2neb4wh3q65w64wqq7x424m3nv3g4563d4536d4536d4536d45")).toBe(true);
    });

    it("should return false for invalid CIDs", () => {
      expect(isValidCID("invalid-cid")).toBe(false);
      expect(isValidCID("QmShort")).toBe(false);
    });

    it("should not throw on valid CID validation", () => {
      expect(() => validateCid("QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco")).not.toThrow();
    });

    it("should throw InvalidCIDError on invalid CID validation", () => {
      expect(() => validateCid("invalid-cid")).toThrow(InvalidCIDError);
    });
  });

  // ─── 2. File Size Validation Tests ─────────────────────────────────────────

  describe("File Size Validation", () => {
    it("should reject files larger than 10MB before any network call", async () => {
      const largeFile = new File([new ArrayBuffer(MAX_FILE_SIZE + 1)], "large.pdf", {
        type: "application/pdf",
      });

      await expect(uploadInvoicePDF(largeFile, "GADDRESS")).rejects.toThrow(FileSizeError);
      expect(mockXhr.open).not.toHaveBeenCalled();
      expect(mockXhr.send).not.toHaveBeenCalled();
    });

    it("should accept files exactly 10MB or smaller", async () => {
      const validFile = new File([new ArrayBuffer(MAX_FILE_SIZE)], "valid.pdf", {
        type: "application/pdf",
      });

      const cid = await uploadInvoicePDF(validFile, "GADDRESS");
      expect(cid).toBe("QmPDFCid1234567890");
      expect(mockXhr.open).toHaveBeenCalled();
    });
  });

  // ─── 3. Pinata Health Check Tests ──────────────────────────────────────────

  describe("Pinata Health Check", () => {
    it("should return true if status is 200 OK", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
      });

      const healthy = await checkPinataHealth();
      expect(healthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should return true if status is 401 Unauthorized (reachable)", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
      });

      const healthy = await checkPinataHealth();
      expect(healthy).toBe(true);
    });

    it("should return false if status is 500 Internal Server Error", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
      });

      const healthy = await checkPinataHealth();
      expect(healthy).toBe(false);
    });

    it("should return false on network error or timeout (aborted)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network Error"));

      const healthy = await checkPinataHealth();
      expect(healthy).toBe(false);
    });

    it("should cache the health check result", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
      });

      const firstCall = await checkPinataHealth();
      const secondCall = await checkPinataHealth();

      expect(firstCall).toBe(true);
      expect(secondCall).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Second call was cached
    });

    it("should re-check health if the cache is invalidated", async () => {
      mockFetch.mockResolvedValue({
        status: 200,
      });

      await checkPinataHealth();
      invalidatePinataHealthCache();
      await checkPinataHealth();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ─── 4. Metadata Upload and Retry Tests ────────────────────────────────────

  describe("uploadInvoiceMetadata (Fetch & Retry)", () => {
    const mockMetadata: any = {
      invoiceNumber: "INV-2024-001",
      amount: 50000,
    };

    it("should successfully upload metadata on first attempt", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cid: "QmMetadataCid1234567890" }),
      });

      const cid = await uploadInvoiceMetadata(mockMetadata, "GADDRESS");
      expect(cid).toBe("QmMetadataCid1234567890");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should retry on 5xx error and succeed if a later attempt succeeds", async () => {
      // 1st attempt: 500 Internal Server Error
      mockFetch.mockRejectedValueOnce(new Error("500 Internal Server Error"));
      // 2nd attempt: 503 Service Unavailable
      mockFetch.mockRejectedValueOnce(new Error("503 Service Unavailable"));
      // 3rd attempt: 200 OK
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cid: "QmMetadataCid1234567890" }),
      });

      const cid = await uploadInvoiceMetadata(mockMetadata, "GADDRESS");
      expect(cid).toBe("QmMetadataCid1234567890");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should fail permanently if all retry attempts fail", async () => {
      // 1st, 2nd, and 3rd attempts: 500 Internal Server Error
      mockFetch.mockRejectedValue(new Error("500 Internal Server Error"));

      await expect(uploadInvoiceMetadata(mockMetadata, "GADDRESS")).rejects.toThrow(
        "500 Internal Server Error"
      );
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should not retry on non-5xx errors (e.g. 400 Bad Request)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(uploadInvoiceMetadata(mockMetadata, "GADDRESS")).rejects.toThrow(
        "Metadata upload failed: 400"
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 5. XHR Upload & Progress Tests ────────────────────────────────────────

  describe("uploadInvoicePDF (XHR & Progress)", () => {
    const dummyFile = new File(["dummy pdf content"], "invoice.pdf", {
      type: "application/pdf",
    });

    it("should upload file successfully", async () => {
      const cid = await uploadInvoicePDF(dummyFile, "GADDRESS");
      expect(cid).toBe("QmPDFCid1234567890");
      expect(mockXhr.open).toHaveBeenCalledWith("POST", "/api/upload");
    });

    it("should call onProgress with correct percentage values", async () => {
      const progressCallback = vi.fn();

      mockXhr.send.mockImplementationOnce(function (this: any) {
        if (this.upload.onprogress) {
          // Simulate progress events
          this.upload.onprogress({ lengthComputable: true, loaded: 25, total: 100 });
          this.upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 });
          this.upload.onprogress({ lengthComputable: true, loaded: 100, total: 100 });
        }
        this.onload();
      });

      await uploadInvoicePDF(dummyFile, "GADDRESS", progressCallback);

      expect(progressCallback).toHaveBeenNthCalledWith(1, 25);
      expect(progressCallback).toHaveBeenNthCalledWith(2, 50);
      expect(progressCallback).toHaveBeenNthCalledWith(3, 100);
    });

    it("should throw error on network failure", async () => {
      mockXhr.send.mockImplementationOnce(function (this: any) {
        this.onerror();
      });

      await expect(uploadInvoicePDF(dummyFile, "GADDRESS")).rejects.toThrow(
        "Network error during IPFS upload"
      );
    });

    it("should throw error on HTTP failure status (e.g. 500)", async () => {
      mockXhr.send.mockImplementationOnce(function (this: any) {
        this.status = 500;
        this.statusText = "Internal Server Error";
        this.onload();
      });

      await expect(uploadInvoicePDF(dummyFile, "GADDRESS")).rejects.toThrow(
        "Upload failed: 500 Internal Server Error"
      );
    });
  });

  // ─── 6. Composite Upload Tests ─────────────────────────────────────────────

  describe("Composite Upload Functions", () => {
    const dummyFile = new File(["dummy pdf"], "invoice.pdf", { type: "application/pdf" });
    const mockMetadata: any = {
      invoiceNumber: "INV-2024-001",
      amount: 50000,
    };

    it("uploadInvoiceToIPFS should upload PDF and then upload metadata with PDF CID", async () => {
      // Setup fetch for metadata upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cid: "QmMetadataCid1234567890" }),
      });

      const result = await uploadInvoiceToIPFS(dummyFile, mockMetadata, "GADDRESS");

      expect(result.pdfCid).toBe("QmPDFCid1234567890"); // From XHR mock
      expect(result.metadataCid).toBe("QmMetadataCid1234567890"); // From Fetch mock

      // Verify that the metadata uploaded contains the correct documentHash and documentUrl
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.metadata.documentHash).toBe("QmPDFCid1234567890");
      expect(fetchBody.metadata.documentUrl).toBe("https://gateway.pinata.cloud/ipfs/QmPDFCid1234567890");
    });

    it("uploadValidatedInvoiceMetadata should validate, generate SVG, upload SVG, and upload metadata", async () => {
      // SVG upload (XHR) will return QmPDFCid1234567890
      // Metadata upload (Fetch) mock:
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cid: "QmMetadataCid1234567890" }),
      });

      const progressCallback = vi.fn();
      const input: any = {
        invoice_number: "INV-2024-001",
        amount: 50000,
      };

      const result = await uploadValidatedInvoiceMetadata(input, "GADDRESS", progressCallback);

      expect(result.imageCid).toBe("QmPDFCid1234567890");
      expect(result.metadataCid).toBe("QmMetadataCid1234567890");

      // Verify progress callbacks are triggered
      expect(progressCallback).toHaveBeenCalled();
    });
  });

  // ─── 7. Unpinning Tests ───────────────────────────────────────────────────

  describe("Unpinning Functions", () => {
    it("unpinFromPinata should return true on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const success = await unpinFromPinata("QmPDFCid1234567890");
      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith("/api/upload", expect.objectContaining({
        method: "DELETE",
      }));
    });

    it("unpinFromPinata should return false on HTTP failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const success = await unpinFromPinata("QmPDFCid1234567890");
      expect(success).toBe(false);
    });

    it("unpinFromPinata should return false on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network Error"));

      const success = await unpinFromPinata("QmPDFCid1234567890");
      expect(success).toBe(false);
    });

    it("unpinMultipleFromPinata should try to unpin all CIDs", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
      });

      const spyConsole = vi.spyOn(console, "warn").mockImplementation(() => {});

      await unpinMultipleFromPinata(["QmPDFCid1", "QmPDFCid2"]);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(spyConsole).not.toHaveBeenCalled();
    });
  });

  // ─── 8. Legacy Helper Tests ────────────────────────────────────────────────

  describe("Legacy Helpers", () => {
    it("uploadFileToPinata should delegate to uploadInvoicePDF", async () => {
      const dummyFile = new File(["legacy content"], "legacy.pdf", { type: "application/pdf" });
      const cid = await uploadFileToPinata(dummyFile, "legacy.pdf", "GADDRESS");
      expect(cid).toBe("QmPDFCid1234567890");
    });

    it("uploadJsonToPinata should upload metadata JSON via fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cid: "QmMetadataCid1234567890" }),
      });

      const cid = await uploadJsonToPinata({ key: "value" }, "metadata.json");
      expect(cid).toBe("QmMetadataCid1234567890");
    });
  });
});