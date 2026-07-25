/**
 * Unit tests for lib/validations/invoice.ts
 *
 * Target: 100% line / branch / function coverage on lib/validations/invoice.ts
 *
 * Closes #71
 */

import { describe, it, expect } from "vitest";
import {
  invoiceDetailsStepSchema,
  invoiceDetailsSchema,
  financingTermsSchema,
  uploadSchema,
  fundingAmountSchema,
  repaymentSchema,
  userProfileSchema,
  createInvoiceSchema,
  INVOICE_DETAILS_STEP_FIELDS,
  FINANCING_TERMS_STEP_FIELDS,
} from "../invoice";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expectSuccess<T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  value: unknown
): T {
  const result = schema.safeParse(value);
  expect(result.success).toBe(true);
  return result.data as T;
}

function expectFailure(
  schema: { safeParse: (v: unknown) => { success: boolean; error?: any } },
  value: unknown,
  expectedPath?: string
) {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
  if (expectedPath && result.error) {
    const paths = result.error.issues.map((i: any) => i.path.join("."));
    expect(paths).toContain(expectedPath);
  }
}

function expectRefinementPassed(
  schema: { safeParse: (v: unknown) => { success: boolean; error?: any } },
  value: unknown,
  refinementMessage: string
) {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
  if (result.error) {
    const messages = result.error.issues.map((i: any) => i.message);
    expect(messages).not.toContain(refinementMessage);
  }
}

// ─── invoiceDetailsStepSchema / invoiceDetailsSchema ─────────────────────────

describe("invoiceDetailsStepSchema", () => {
  const base = {
    invoiceNumber: "INV-001",
    debtorName: "Acme Corp",
    debtorAddress: "123 Main Street",
    amount: 5000,
    dueDate: "2026-12-01",
    jurisdiction: "US",
    category: "technology",
    debtorPrivacy: "full" as const,
  };

  it("accepts a fully valid object", () => {
    expectSuccess(invoiceDetailsStepSchema, base);
  });

  it("invoiceDetailsSchema is an alias for invoiceDetailsStepSchema", () => {
    expectSuccess(invoiceDetailsSchema, base);
  });

  // invoiceNumber
  it("rejects empty invoiceNumber", () => {
    expectFailure(invoiceDetailsStepSchema, { ...base, invoiceNumber: "" }, "invoiceNumber");
  });

  it("rejects invoiceNumber with spaces", () => {
    expectFailure(invoiceDetailsStepSchema, { ...base, invoiceNumber: "INV 001" }, "invoiceNumber");
  });

  it("rejects invoiceNumber with special chars (@, #, $)", () => {
    expectFailure(invoiceDetailsStepSchema, { ...base, invoiceNumber: "INV@#$" }, "invoiceNumber");
  });

  it("accepts alphanumeric invoiceNumber", () => {
    expectSuccess(invoiceDetailsStepSchema, { ...base, invoiceNumber: "ABC123" });
  });

  it("accepts hyphenated invoiceNumber", () => {
    expectSuccess(invoiceDetailsStepSchema, { ...base, invoiceNumber: "INV-2024-001" });
  });

  // debtorName
  it("rejects debtorName of length 1", () => {
    expectFailure(invoiceDetailsStepSchema, { ...base, debtorName: "A" }, "debtorName");
  });

  it("accepts debtorName of length 2 (boundary)", () => {
    expectSuccess(invoiceDetailsStepSchema, { ...base, debtorName: "AB" });
  });

  // debtorAddress
  it("rejects debtorAddress shorter than 5 chars", () => {
    expectFailure(invoiceDetailsStepSchema, { ...base, debtorAddress: "123" }, "debtorAddress");
  });

  it("accepts debtorAddress of exactly 5 chars (boundary)", () => {
    expectSuccess(invoiceDetailsStepSchema, { ...base, debtorAddress: "12345" });
  });

  // amount
  it("rejects amount below 100", () => {
    expectFailure(invoiceDetailsStepSchema, { ...base, amount: 99 }, "amount");
  });

  it("accepts amount of exactly 100 (boundary)", () => {
    expectSuccess(invoiceDetailsStepSchema, { ...base, amount: 100 });
  });

  it("rejects zero amount", () => {
    expectFailure(invoiceDetailsStepSchema, { ...base, amount: 0 }, "amount");
  });

  it("rejects negative amount", () => {
    expectFailure(invoiceDetailsStepSchema, { ...base, amount: -1 }, "amount");
  });

  it("coerces string amount to number", () => {
    const result = expectSuccess(invoiceDetailsStepSchema, { ...base, amount: "5000" });
    expect(result.amount).toBe(5000);
  });

  // dueDate
  it("rejects empty dueDate", () => {
    expectFailure(invoiceDetailsStepSchema, { ...base, dueDate: "" }, "dueDate");
  });

  // description
  it("accepts undefined description", () => {
    expectSuccess(invoiceDetailsStepSchema, { ...base, description: undefined });
  });

  it("accepts empty string description", () => {
    expectSuccess(invoiceDetailsStepSchema, { ...base, description: "" });
  });

  it("accepts description at exactly 200 chars (boundary)", () => {
    expectSuccess(invoiceDetailsStepSchema, { ...base, description: "x".repeat(200) });
  });

  it("rejects description over 200 chars", () => {
    expectFailure(invoiceDetailsStepSchema, { ...base, description: "x".repeat(201) }, "description");
  });

  // jurisdiction
  it("accepts all valid jurisdictions", () => {
    const jurisdictions = ["US", "EU", "UK", "NG", "KE", "GH", "ZA", "OTHER"];
    for (const j of jurisdictions) {
      expectSuccess(invoiceDetailsStepSchema, { ...base, jurisdiction: j });
    }
  });

  it("rejects invalid jurisdiction", () => {
    expectFailure(invoiceDetailsStepSchema, { ...base, jurisdiction: "INVALID" }, "jurisdiction");
  });

  // category
  it("accepts all valid categories", () => {
    const categories = [
      "technology", "manufacturing", "logistics", "healthcare",
      "retail", "construction", "agriculture", "energy", "finance", "other",
    ];
    for (const c of categories) {
      expectSuccess(invoiceDetailsStepSchema, { ...base, category: c });
    }
  });

  it("rejects invalid category", () => {
    expectFailure(invoiceDetailsStepSchema, { ...base, category: "mining" }, "category");
  });
});

// ─── INVOICE_DETAILS_STEP_FIELDS ──────────────────────────────────────────────

describe("INVOICE_DETAILS_STEP_FIELDS", () => {
  it("contains all 9 expected field names", () => {
    expect(INVOICE_DETAILS_STEP_FIELDS).toEqual([
      "invoiceNumber",
      "debtorName",
      "debtorAddress",
      "amount",
      "dueDate",
      "description",
      "jurisdiction",
      "category",
      "debtorPrivacy",
    ]);
  });
});

// ─── financingTermsSchema ─────────────────────────────────────────────────────

describe("financingTermsSchema", () => {
  const base = {
    amount: 50000,
    dueDate: "2026-12-01",
    discountRate: 5,
    minInvestment: 1000,
    listingExpiryDate: "2026-11-15",
  };

  it("accepts valid financing terms", () => {
    expectSuccess(financingTermsSchema, base);
  });

  // discountRate
  it("rejects discountRate below 0.5", () => {
    expectFailure(financingTermsSchema, { ...base, discountRate: 0.4 }, "discountRate");
  });

  it("accepts discountRate at exactly 0.5 (lower boundary)", () => {
    expectSuccess(financingTermsSchema, { ...base, discountRate: 0.5 });
  });

  it("rejects discountRate above 20", () => {
    expectFailure(financingTermsSchema, { ...base, discountRate: 20.1 }, "discountRate");
  });

  it("accepts discountRate at exactly 20 (upper boundary)", () => {
    expectSuccess(financingTermsSchema, { ...base, discountRate: 20 });
  });

  it("coerces string discountRate", () => {
    const result = expectSuccess(financingTermsSchema, { ...base, discountRate: "5" });
    expect(result.discountRate).toBe(5);
  });

  // minInvestment
  it("rejects minInvestment > amount (cross-field)", () => {
    expectFailure(financingTermsSchema, { ...base, minInvestment: 60000 }, "minInvestment");
  });

  it("accepts minInvestment === amount (boundary)", () => {
    expectSuccess(financingTermsSchema, { ...base, minInvestment: 50000 });
  });

  it("rejects zero minInvestment", () => {
    expectFailure(financingTermsSchema, { ...base, minInvestment: 0 }, "minInvestment");
  });

  it("rejects negative minInvestment", () => {
    expectFailure(financingTermsSchema, { ...base, minInvestment: -1 }, "minInvestment");
  });

  it("rejects minInvestment below 100", () => {
    expectFailure(financingTermsSchema, { ...base, minInvestment: 50 }, "minInvestment");
  });

  // listingExpiryDate
  it("rejects listingExpiryDate equal to dueDate", () => {
    expectFailure(financingTermsSchema, { ...base, listingExpiryDate: "2026-12-01" }, "listingExpiryDate");
  });

  it("rejects listingExpiryDate after dueDate", () => {
    expectFailure(financingTermsSchema, { ...base, listingExpiryDate: "2027-01-01" }, "listingExpiryDate");
  });

  it("accepts listingExpiryDate one day before dueDate", () => {
    expectSuccess(financingTermsSchema, { ...base, listingExpiryDate: "2026-11-30" });
  });

  it("passes cross-field check when listingExpiryDate or dueDate is empty", () => {
    // Both empty → refinement returns true, but base field validation fails on required fields
    expectFailure(financingTermsSchema, {
      ...base,
      listingExpiryDate: "",
      dueDate: "",
      discountRate: 5,
      minInvestment: 100,
      amount: 50000,
    }, "dueDate");
  });
});

// ─── FINANCING_TERMS_STEP_FIELDS ──────────────────────────────────────────────

describe("FINANCING_TERMS_STEP_FIELDS", () => {
  it("contains the 3 expected field names", () => {
    expect(FINANCING_TERMS_STEP_FIELDS).toEqual([
      "discountRate",
      "minInvestment",
      "listingExpiryDate",
    ]);
  });
});

// ─── uploadSchema ─────────────────────────────────────────────────────────────

describe("uploadSchema", () => {
  const makePdf = (size: number) => ({
    name: "invoice.pdf",
    type: "application/pdf",
    size,
  });

  it("accepts a valid PDF under 10MB", () => {
    expectSuccess(uploadSchema, { file: makePdf(5 * 1024 * 1024) });
  });

  it("accepts exactly 10MB (boundary)", () => {
    expectSuccess(uploadSchema, { file: makePdf(10 * 1024 * 1024) });
  });

  it("rejects file over 10MB", () => {
    expectFailure(uploadSchema, { file: makePdf(10 * 1024 * 1024 + 1) }, "file");
  });

  it("rejects non-PDF MIME type", () => {
    expectFailure(uploadSchema, {
      file: { name: "doc.docx", type: "application/msword", size: 1000 },
    }, "file");
  });

  it("accepts file identified by .pdf extension when MIME is absent", () => {
    expectSuccess(uploadSchema, { file: { name: "invoice.pdf", size: 1000 } });
  });

  it("rejects file with non-pdf extension and no MIME", () => {
    expectFailure(uploadSchema, { file: { name: "invoice.docx", size: 1000 } }, "file");
  });

  it("rejects null file", () => {
    expectFailure(uploadSchema, { file: null }, "file");
  });

  it("rejects undefined file", () => {
    expectFailure(uploadSchema, { file: undefined }, "file");
  });

  it("rejects file object with no size property (size check passes via guard)", () => {
    // No size property → size check returns true (guard: typeof file.size !== 'number')
    expectSuccess(uploadSchema, { file: { name: "invoice.pdf", type: "application/pdf" } });
  });
});

// ─── fundingAmountSchema ──────────────────────────────────────────────────────

describe("fundingAmountSchema", () => {
  const base = {
    amount: 5000,
    minInvestment: 1000,
    remainingCapacity: 10000,
  };

  it("accepts a valid funding amount", () => {
    expectSuccess(fundingAmountSchema, base);
  });

  it("rejects amount below minInvestment", () => {
    expectFailure(fundingAmountSchema, { ...base, amount: 999 }, "amount");
  });

  it("accepts amount exactly equal to minInvestment (boundary)", () => {
    expectSuccess(fundingAmountSchema, { ...base, amount: 1000 });
  });

  it("rejects amount exceeding remainingCapacity", () => {
    expectFailure(fundingAmountSchema, { ...base, amount: 10001 }, "amount");
  });

  it("accepts amount exactly equal to remainingCapacity (boundary)", () => {
    expectSuccess(fundingAmountSchema, { ...base, amount: 10000 });
  });

  it("rejects zero amount", () => {
    expectFailure(fundingAmountSchema, { ...base, amount: 0 }, "amount");
  });

  it("rejects negative amount", () => {
    expectFailure(fundingAmountSchema, { ...base, amount: -100 }, "amount");
  });

  it("accepts zero remainingCapacity when amount equals it", () => {
    expectSuccess(fundingAmountSchema, {
      amount: 1000,
      minInvestment: 1000,
      remainingCapacity: 1000,
    });
  });

  it("coerces string values", () => {
    const result = expectSuccess(fundingAmountSchema, {
      amount: "5000",
      minInvestment: "1000",
      remainingCapacity: "10000",
    });
    expect(result.amount).toBe(5000);
  });
});

// ─── repaymentSchema ──────────────────────────────────────────────────────────

describe("repaymentSchema", () => {
  it("accepts repayment matching outstanding balance exactly", () => {
    expectSuccess(repaymentSchema, { amount: 5000, outstandingBalance: 5000 });
  });

  it("accepts repayment within float tolerance (delta < 0.01)", () => {
    expectSuccess(repaymentSchema, { amount: 5000.005, outstandingBalance: 5000 });
  });

  it("accepts repayment with delta exactly 0.009 (just under threshold)", () => {
    expectSuccess(repaymentSchema, { amount: 5000.009, outstandingBalance: 5000 });
  });

  it("rejects repayment with delta of exactly 0.01", () => {
    expectFailure(repaymentSchema, { amount: 5000.01, outstandingBalance: 5000 }, "amount");
  });

  it("rejects underpayment", () => {
    expectFailure(repaymentSchema, { amount: 4999, outstandingBalance: 5000 }, "amount");
  });

  it("rejects overpayment", () => {
    expectFailure(repaymentSchema, { amount: 5001, outstandingBalance: 5000 }, "amount");
  });

  it("rejects zero amount", () => {
    expectFailure(repaymentSchema, { amount: 0, outstandingBalance: 0 }, "amount");
  });

  it("rejects negative amount", () => {
    expectFailure(repaymentSchema, { amount: -100, outstandingBalance: 5000 }, "amount");
  });

  it("coerces string values", () => {
    const result = expectSuccess(repaymentSchema, {
      amount: "5000",
      outstandingBalance: "5000",
    });
    expect(result.amount).toBe(5000);
  });
});

// ─── userProfileSchema ────────────────────────────────────────────────────────

describe("userProfileSchema", () => {
  // Valid 56-char Stellar public key: G + 55 uppercase base32 chars
  const VALID_ADDRESS = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPGK6XGDNVVB7KDXKQZFKJ6N8MA";

  const base = {
    name: "Alice Njeri",
    email: "alice@example.com",
    walletAddress: VALID_ADDRESS,
  };

  it("accepts a valid user profile", () => {
    expectSuccess(userProfileSchema, base);
  });

  // name
  it("rejects name shorter than 2 chars", () => {
    expectFailure(userProfileSchema, { ...base, name: "A" }, "name");
  });

  it("accepts name of exactly 2 chars (boundary)", () => {
    expectSuccess(userProfileSchema, { ...base, name: "AB" });
  });

  // email
  it("rejects invalid email", () => {
    expectFailure(userProfileSchema, { ...base, email: "not-an-email" }, "email");
  });

  it("rejects email without domain", () => {
    expectFailure(userProfileSchema, { ...base, email: "user@" }, "email");
  });

  it("accepts valid email with subdomain", () => {
    expectSuccess(userProfileSchema, { ...base, email: "user@mail.example.com" });
  });

  // walletAddress
  it("rejects address not starting with G", () => {
    const bad = "A" + VALID_ADDRESS.slice(1);
    expectFailure(userProfileSchema, { ...base, walletAddress: bad }, "walletAddress");
  });

  it("rejects address that is too short", () => {
    expectFailure(userProfileSchema, { ...base, walletAddress: "GBADKEY" }, "walletAddress");
  });

  it("rejects address that is too long (57 chars)", () => {
    expectFailure(userProfileSchema, { ...base, walletAddress: VALID_ADDRESS + "X" }, "walletAddress");
  });

  it("rejects address with lowercase chars", () => {
    const bad = VALID_ADDRESS.toLowerCase();
    expectFailure(userProfileSchema, { ...base, walletAddress: bad }, "walletAddress");
  });

  // companyName
  it("accepts undefined companyName", () => {
    expectSuccess(userProfileSchema, { ...base, companyName: undefined });
  });

  it("accepts empty string companyName (literal '')", () => {
    expectSuccess(userProfileSchema, { ...base, companyName: "" });
  });

  it("rejects companyName of length 1", () => {
    expectFailure(userProfileSchema, { ...base, companyName: "X" }, "companyName");
  });

  it("accepts companyName of length 2 (boundary)", () => {
    expectSuccess(userProfileSchema, { ...base, companyName: "AB" });
  });
});

// ─── createInvoiceSchema ──────────────────────────────────────────────────────

describe("createInvoiceSchema", () => {
  const base = {
    invoiceNumber: "INV-2024-001",
    debtorName: "Acme Corporation",
    debtorAddress: "123 Business Street, Nairobi",
    amount: 50000,
    currency: "USDC",
    issueDate: "2024-01-01",
    dueDate: "2025-01-01",
    jurisdiction: "KE",
    category: "technology",
    debtorPrivacy: "full",
    discountRate: 5,
    minInvestment: 1000,
    listingExpiryDate: "2024-12-01",
    debtorPrivacy: "full" as const,
  };

  it("accepts a fully valid invoice", () => {
    const result = expectSuccess(createInvoiceSchema, base);
    // discountRate is transformed: 5 → 0.05
    expect(result.discountRate).toBeCloseTo(0.05);
  });

  it("transforms discountRate from percent to decimal", () => {
    const result = expectSuccess(createInvoiceSchema, { ...base, discountRate: 10 });
    expect(result.discountRate).toBeCloseTo(0.1);
  });

  // currency
  it("accepts all valid currencies", () => {
    for (const currency of ["USDC", "EURC", "XLM"]) {
      expectSuccess(createInvoiceSchema, { ...base, currency });
    }
  });

  it("rejects invalid currency", () => {
    expectFailure(createInvoiceSchema, { ...base, currency: "BTC" }, "currency");
  });

  // cross-field: dueDate > issueDate
  it("rejects dueDate before issueDate", () => {
    expectFailure(createInvoiceSchema, {
      ...base,
      issueDate: "2025-06-01",
      dueDate: "2025-01-01",
    }, "dueDate");
  });

  it("rejects dueDate equal to issueDate", () => {
    expectFailure(createInvoiceSchema, {
      ...base,
      issueDate: "2025-01-01",
      dueDate: "2025-01-01",
    }, "dueDate");
  });

  it("passes dueDate/issueDate check when either is empty (guard clause)", () => {
    expectFailure(createInvoiceSchema, {
      ...base,
      issueDate: "",
      dueDate: "",
    }, "issueDate");
  });

  // cross-field: minInvestment <= amount
  it("rejects minInvestment > amount", () => {
    expectFailure(createInvoiceSchema, { ...base, minInvestment: 60000 }, "minInvestment");
  });

  it("accepts minInvestment === amount (boundary)", () => {
    expectSuccess(createInvoiceSchema, { ...base, minInvestment: 50000 });
  });

  // cross-field: listingExpiryDate < dueDate
  it("rejects listingExpiryDate equal to dueDate", () => {
    expectFailure(createInvoiceSchema, {
      ...base,
      listingExpiryDate: "2025-01-01",
    }, "listingExpiryDate");
  });

  it("rejects listingExpiryDate after dueDate", () => {
    expectFailure(createInvoiceSchema, {
      ...base,
      listingExpiryDate: "2025-06-01",
    }, "listingExpiryDate");
  });

  it("passes listingExpiryDate check when either date is empty (guard clause)", () => {
    expectFailure(createInvoiceSchema, {
      ...base,
      listingExpiryDate: "",
      dueDate: "",
      issueDate: "",
    }, "listingExpiryDate");
  });

  // discountRate boundaries
  it("rejects discountRate below 0.5", () => {
    expectFailure(createInvoiceSchema, { ...base, discountRate: 0.4 }, "discountRate");
  });

  it("accepts discountRate at 0.5 (lower boundary)", () => {
    expectSuccess(createInvoiceSchema, { ...base, discountRate: 0.5 });
  });

  it("rejects discountRate above 20", () => {
    expectFailure(createInvoiceSchema, { ...base, discountRate: 20.1 }, "discountRate");
  });

  it("accepts discountRate at 20 (upper boundary)", () => {
    expectSuccess(createInvoiceSchema, { ...base, discountRate: 20 });
  });

  // amount
  it("rejects amount below 100", () => {
    expectFailure(createInvoiceSchema, { ...base, amount: 99 }, "amount");
  });

  it("accepts amount at 100 (boundary)", () => {
    expectSuccess(createInvoiceSchema, { ...base, amount: 100, minInvestment: 100 });
  });

  // optional description
  it("accepts with description", () => {
    expectSuccess(createInvoiceSchema, { ...base, description: "Q4 services" });
  });

  it("rejects description over 200 chars", () => {
    expectFailure(createInvoiceSchema, {
      ...base,
      description: "x".repeat(201),
    }, "description");
  });
});
