/**
 * Tests for locale-specific Zod validation messages.
 *
 * Verifies that:
 *  - buildInvoiceDetailsStepSchema / buildFinancingTermsSchema / buildCreateInvoiceSchema
 *    emit localized error messages when given a specific ValidationMessages object
 *  - buildLocalizedInvoiceSchemas returns distinct schemas for each locale
 *  - getValidationMessages returns the correct message set per locale
 *  - createLocalizedErrorMap maps Zod error codes to locale strings
 *
 * Closes #(zod-i18n issue)
 */

import { describe, it, expect } from "vitest";
import {
  buildInvoiceDetailsStepSchema,
  buildFinancingTermsSchema,
  buildCreateInvoiceSchema,
  buildFundingAmountSchema,
  buildRepaymentSchema,
  buildUserProfileSchema,
  buildLocalizedInvoiceSchemas,
} from "../invoice";
import {
  getValidationMessages,
  createLocalizedErrorMap,
} from "../locales";
import { z } from "zod";
import type { Locale } from "@/i18n/config";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstError(
  schema: { safeParse: (v: unknown) => { success: boolean; error?: z.ZodError } },
  value: unknown,
  path?: string
): string | undefined {
  const result = schema.safeParse(value);
  if (result.success) return undefined;
  const issues = result.error?.issues ?? [];
  if (path) {
    const found = issues.find((i) => i.path.join(".") === path);
    return found?.message;
  }
  return issues[0]?.message;
}

// ─── getValidationMessages ────────────────────────────────────────────────────

describe("getValidationMessages", () => {
  const locales: Locale[] = ["en", "es", "ar", "pt-BR"];

  it("returns messages for all supported locales", () => {
    for (const locale of locales) {
      const msgs = getValidationMessages(locale);
      expect(msgs).toBeDefined();
      expect(typeof msgs.invoiceNumberRequired).toBe("string");
      expect(msgs.invoiceNumberRequired.length).toBeGreaterThan(0);
    }
  });

  it("en messages are in English", () => {
    const msgs = getValidationMessages("en");
    expect(msgs.invoiceNumberRequired).toBe("Invoice number is required");
    expect(msgs.amountMin).toBe("Minimum $100 USDC");
  });

  it("es messages are in Spanish", () => {
    const msgs = getValidationMessages("es");
    expect(msgs.invoiceNumberRequired).toBe("El número de factura es requerido");
    expect(msgs.amountMin).toBe("Mínimo 100 USDC");
  });

  it("ar messages are in Arabic", () => {
    const msgs = getValidationMessages("ar");
    expect(msgs.invoiceNumberRequired).toBe("رقم الفاتورة مطلوب");
    expect(msgs.amountMin).toBe("الحد الأدنى 100 USDC");
  });

  it("pt-BR messages are in Portuguese", () => {
    const msgs = getValidationMessages("pt-BR");
    expect(msgs.invoiceNumberRequired).toBe("O número da fatura é obrigatório");
    expect(msgs.amountMin).toBe("Mínimo $100 USDC");
  });

  it("all locales have distinct invoiceNumberRequired messages", () => {
    const messages = locales.map((l) => getValidationMessages(l).invoiceNumberRequired);
    const unique = new Set(messages);
    expect(unique.size).toBe(locales.length);
  });
});

// ─── buildInvoiceDetailsStepSchema (per locale) ───────────────────────────────

describe("buildInvoiceDetailsStepSchema — locale messages", () => {
  const baseValid = {
    invoiceNumber: "INV-001",
    debtorName: "Acme Corp",
    debtorAddress: "123 Main Street",
    amount: 5000,
    dueDate: "2026-12-01",
    jurisdiction: "US",
    category: "technology",
    debtorPrivacy: "full" as const,
  };

  it("en: empty invoiceNumber → English error", () => {
    const schema = buildInvoiceDetailsStepSchema(getValidationMessages("en"));
    const msg = firstError(schema, { ...baseValid, invoiceNumber: "" }, "invoiceNumber");
    expect(msg).toBe("Invoice number is required");
  });

  it("es: empty invoiceNumber → Spanish error", () => {
    const schema = buildInvoiceDetailsStepSchema(getValidationMessages("es"));
    const msg = firstError(schema, { ...baseValid, invoiceNumber: "" }, "invoiceNumber");
    expect(msg).toBe("El número de factura es requerido");
  });

  it("ar: empty invoiceNumber → Arabic error", () => {
    const schema = buildInvoiceDetailsStepSchema(getValidationMessages("ar"));
    const msg = firstError(schema, { ...baseValid, invoiceNumber: "" }, "invoiceNumber");
    expect(msg).toBe("رقم الفاتورة مطلوب");
  });

  it("pt-BR: empty invoiceNumber → Portuguese error", () => {
    const schema = buildInvoiceDetailsStepSchema(getValidationMessages("pt-BR"));
    const msg = firstError(schema, { ...baseValid, invoiceNumber: "" }, "invoiceNumber");
    expect(msg).toBe("O número da fatura é obrigatório");
  });

  it("es: invalid invoiceNumber characters → Spanish error", () => {
    const schema = buildInvoiceDetailsStepSchema(getValidationMessages("es"));
    const msg = firstError(schema, { ...baseValid, invoiceNumber: "INV@#$" }, "invoiceNumber");
    expect(msg).toBe(
      "El número de factura debe contener solo caracteres alfanuméricos y guiones"
    );
  });

  it("ar: amount below min → Arabic error", () => {
    const schema = buildInvoiceDetailsStepSchema(getValidationMessages("ar"));
    const msg = firstError(schema, { ...baseValid, amount: 50 }, "amount");
    expect(msg).toBe("الحد الأدنى 100 USDC");
  });

  it("pt-BR: short debtorName → Portuguese error", () => {
    const schema = buildInvoiceDetailsStepSchema(getValidationMessages("pt-BR"));
    const msg = firstError(schema, { ...baseValid, debtorName: "A" }, "debtorName");
    expect(msg).toBe("O nome do devedor é obrigatório");
  });

  it("es: short debtorAddress → Spanish error", () => {
    const schema = buildInvoiceDetailsStepSchema(getValidationMessages("es"));
    const msg = firstError(schema, { ...baseValid, debtorAddress: "123" }, "debtorAddress");
    expect(msg).toBe("La dirección del deudor es requerida");
  });
});

// ─── buildFinancingTermsSchema (per locale) ───────────────────────────────────

describe("buildFinancingTermsSchema — locale messages", () => {
  const baseValid = {
    amount: 50000,
    dueDate: "2026-12-01",
    discountRate: 5,
    minInvestment: 1000,
    listingExpiryDate: "2026-11-15",
  };

  it("en: discountRate too low → English error", () => {
    const schema = buildFinancingTermsSchema(getValidationMessages("en"));
    const msg = firstError(schema, { ...baseValid, discountRate: 0.3 }, "discountRate");
    expect(msg).toBe("Min 0.5%");
  });

  it("es: discountRate too low → Spanish error", () => {
    const schema = buildFinancingTermsSchema(getValidationMessages("es"));
    const msg = firstError(schema, { ...baseValid, discountRate: 0.3 }, "discountRate");
    expect(msg).toBe("Mín 0.5%");
  });

  it("ar: discountRate too high → Arabic error", () => {
    const schema = buildFinancingTermsSchema(getValidationMessages("ar"));
    const msg = firstError(schema, { ...baseValid, discountRate: 25 }, "discountRate");
    expect(msg).toBe("الحد الأقصى 20%");
  });

  it("pt-BR: discountRate too high → Portuguese error", () => {
    const schema = buildFinancingTermsSchema(getValidationMessages("pt-BR"));
    const msg = firstError(schema, { ...baseValid, discountRate: 25 }, "discountRate");
    expect(msg).toBe("Máx 20%");
  });

  it("es: minInvestment exceeds amount (cross-field refine) → Spanish error", () => {
    const schema = buildFinancingTermsSchema(getValidationMessages("es"));
    const msg = firstError(schema, { ...baseValid, minInvestment: 60000 }, "minInvestment");
    expect(msg).toBe(
      "La inversión mínima no puede exceder el monto total de la factura"
    );
  });

  it("ar: listingExpiryDate after dueDate (cross-field refine) → Arabic error", () => {
    const schema = buildFinancingTermsSchema(getValidationMessages("ar"));
    const msg = firstError(
      schema,
      { ...baseValid, listingExpiryDate: "2027-01-01" },
      "listingExpiryDate"
    );
    expect(msg).toBe("يجب أن يكون تاريخ انتهاء الإدراج قبل تاريخ الاستحقاق");
  });

  it("pt-BR: listingExpiryDate after dueDate → Portuguese error", () => {
    const schema = buildFinancingTermsSchema(getValidationMessages("pt-BR"));
    const msg = firstError(
      schema,
      { ...baseValid, listingExpiryDate: "2027-01-01" },
      "listingExpiryDate"
    );
    expect(msg).toBe(
      "A data de expiração da listagem deve ser estritamente anterior à data de vencimento"
    );
  });
});

// ─── buildCreateInvoiceSchema (per locale) ───────────────────────────────────

describe("buildCreateInvoiceSchema — locale messages", () => {
  const baseValid = {
    invoiceNumber: "INV-2024-001",
    debtorName: "Acme Corporation",
    debtorAddress: "123 Business Street, Nairobi",
    amount: 50000,
    currency: "USDC",
    issueDate: "2024-01-01",
    dueDate: "2025-01-01",
    jurisdiction: "KE",
    category: "technology",
    debtorPrivacy: "full" as const,
    discountRate: 5,
    minInvestment: 1000,
    listingExpiryDate: "2024-12-01",
  };

  it("es: dueDate before issueDate → Spanish error", () => {
    const schema = buildCreateInvoiceSchema(getValidationMessages("es"));
    const msg = firstError(
      schema,
      { ...baseValid, issueDate: "2025-06-01", dueDate: "2024-01-01" },
      "dueDate"
    );
    expect(msg).toBe(
      "La fecha de vencimiento debe ser posterior a la fecha de emisión"
    );
  });

  it("ar: minInvestment > amount → Arabic cross-field error", () => {
    const schema = buildCreateInvoiceSchema(getValidationMessages("ar"));
    const msg = firstError(schema, { ...baseValid, minInvestment: 99999 }, "minInvestment");
    expect(msg).toBe(
      "لا يمكن أن يتجاوز الحد الأدنى للاستثمار إجمالي قيمة الفاتورة"
    );
  });

  it("pt-BR: description too long → Portuguese error", () => {
    const schema = buildCreateInvoiceSchema(getValidationMessages("pt-BR"));
    const msg = firstError(
      schema,
      { ...baseValid, description: "x".repeat(201) },
      "description"
    );
    expect(msg).toBe("A descrição não pode exceder 200 caracteres");
  });
});

// ─── buildLocalizedInvoiceSchemas ─────────────────────────────────────────────

describe("buildLocalizedInvoiceSchemas", () => {
  it("returns distinct schemas for each locale", () => {
    const enSchemas = buildLocalizedInvoiceSchemas("en");
    const esSchemas = buildLocalizedInvoiceSchemas("es");

    // They should be different objects
    expect(enSchemas.createInvoiceSchema).not.toBe(esSchemas.createInvoiceSchema);
  });

  it("es schemas emit Spanish errors", () => {
    const { invoiceDetailsStepSchema } = buildLocalizedInvoiceSchemas("es");
    const result = invoiceDetailsStepSchema.safeParse({
      invoiceNumber: "",
      debtorName: "Acme",
      debtorAddress: "123 Main St",
      amount: 5000,
      dueDate: "2026-12-01",
      jurisdiction: "US",
      category: "technology",
      debtorPrivacy: "full",
    });
    expect(result.success).toBe(false);
    const msg = result.error?.issues.find((i) => i.path[0] === "invoiceNumber")?.message;
    expect(msg).toBe("El número de factura es requerido");
  });

  it("ar schemas emit Arabic errors", () => {
    const { financingTermsSchema } = buildLocalizedInvoiceSchemas("ar");
    const result = financingTermsSchema.safeParse({
      amount: 50000,
      dueDate: "2026-12-01",
      discountRate: 0.1,
      minInvestment: 1000,
      listingExpiryDate: "2026-11-15",
    });
    expect(result.success).toBe(false);
    const msg = result.error?.issues.find((i) => i.path[0] === "discountRate")?.message;
    expect(msg).toBe("الحد الأدنى 0.5%");
  });

  it("pt-BR schemas emit Portuguese errors", () => {
    const { invoiceDetailsStepSchema } = buildLocalizedInvoiceSchemas("pt-BR");
    const result = invoiceDetailsStepSchema.safeParse({
      invoiceNumber: "INV@#$",
      debtorName: "Acme",
      debtorAddress: "123 Main St",
      amount: 5000,
      dueDate: "2026-12-01",
      jurisdiction: "US",
      category: "technology",
      debtorPrivacy: "full",
    });
    expect(result.success).toBe(false);
    const msg = result.error?.issues.find((i) => i.path[0] === "invoiceNumber")?.message;
    expect(msg).toBe(
      "O número da fatura deve conter apenas caracteres alfanuméricos e hifens"
    );
  });
});

// ─── createLocalizedErrorMap ──────────────────────────────────────────────────

describe("createLocalizedErrorMap", () => {
  function runMap(
    locale: Locale,
    issue: Partial<z.ZodIssue>,
    ctx: Partial<z.ErrorMapCtx> = {}
  ): string {
    const map = createLocalizedErrorMap(locale);
    const fullCtx: z.ErrorMapCtx = { defaultError: "default error", ...ctx };
    return map(issue as z.ZodIssue, fullCtx).message;
  }

  it("en: too_small string (invoiceNumber) → English required message", () => {
    const msg = runMap("en", {
      code: z.ZodIssueCode.too_small,
      type: "string",
      path: ["invoiceNumber"],
      minimum: 1,
      inclusive: true,
      message: "",
    });
    expect(msg).toBe("Invoice number is required");
  });

  it("es: too_small string (invoiceNumber) → Spanish required message", () => {
    const msg = runMap("es", {
      code: z.ZodIssueCode.too_small,
      type: "string",
      path: ["invoiceNumber"],
      minimum: 1,
      inclusive: true,
      message: "",
    });
    expect(msg).toBe("El número de factura es requerido");
  });

  it("ar: invalid_string email → Arabic email error", () => {
    const msg = runMap("ar", {
      code: z.ZodIssueCode.invalid_string,
      validation: "email",
      path: ["email"],
      message: "",
    });
    expect(msg).toBe("عنوان البريد الإلكتروني غير صالح");
  });

  it("pt-BR: too_big (discountRate) → Portuguese max error", () => {
    const msg = runMap("pt-BR", {
      code: z.ZodIssueCode.too_big,
      type: "number",
      path: ["discountRate"],
      maximum: 20,
      inclusive: true,
      message: "",
    });
    expect(msg).toBe("Máx 20%");
  });

  it("unknown code falls back to ctx.defaultError", () => {
    const msg = runMap("en", {
      code: z.ZodIssueCode.invalid_date,
      path: [],
      message: "",
    } as any, { defaultError: "fallback" });
    expect(msg).toBe("fallback");
  });

  it("custom code preserves existing message", () => {
    const msg = runMap("es", {
      code: z.ZodIssueCode.custom,
      path: ["minInvestment"],
      message: "La inversión mínima no puede exceder el monto total de la factura",
    });
    expect(msg).toBe("La inversión mínima no puede exceder el monto total de la factura");
  });
});

// ─── buildFundingAmountSchema / buildRepaymentSchema ─────────────────────────

describe("buildFundingAmountSchema — locale messages", () => {
  it("es: amount below minInvestment → Spanish error", () => {
    const schema = buildFundingAmountSchema(getValidationMessages("es"));
    const result = schema.safeParse({ amount: 500, minInvestment: 1000, remainingCapacity: 10000 });
    expect(result.success).toBe(false);
    const msg = result.error?.issues.find((i) => i.path[0] === "amount")?.message;
    expect(msg).toBe(
      "El monto de financiamiento debe ser al menos el monto de inversión mínima"
    );
  });

  it("ar: amount exceeds capacity → Arabic error", () => {
    const schema = buildFundingAmountSchema(getValidationMessages("ar"));
    const result = schema.safeParse({ amount: 20000, minInvestment: 1000, remainingCapacity: 10000 });
    expect(result.success).toBe(false);
    const msg = result.error?.issues.find((i) => i.path[0] === "amount")?.message;
    expect(msg).toBe("لا يمكن أن يتجاوز مبلغ التمويل الطاقة المتبقية");
  });
});

describe("buildRepaymentSchema — locale messages", () => {
  it("pt-BR: repayment mismatch → Portuguese error", () => {
    const schema = buildRepaymentSchema(getValidationMessages("pt-BR"));
    const result = schema.safeParse({ amount: 4000, outstandingBalance: 5000 });
    expect(result.success).toBe(false);
    const msg = result.error?.issues.find((i) => i.path[0] === "amount")?.message;
    expect(msg).toBe(
      "O valor do reembolso deve corresponder exatamente ao saldo pendente"
    );
  });
});

// ─── buildUserProfileSchema ───────────────────────────────────────────────────

describe("buildUserProfileSchema — locale messages", () => {
  const VALID_ADDRESS = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPGK6XGDNVVB7KDXKQZFKJ6N8MA";

  it("es: invalid email → Spanish error", () => {
    const schema = buildUserProfileSchema(getValidationMessages("es"));
    const result = schema.safeParse({
      name: "Alice",
      email: "not-an-email",
      walletAddress: VALID_ADDRESS,
    });
    expect(result.success).toBe(false);
    const msg = result.error?.issues.find((i) => i.path[0] === "email")?.message;
    expect(msg).toBe("Dirección de correo electrónico inválida");
  });

  it("ar: invalid walletAddress → Arabic error", () => {
    const schema = buildUserProfileSchema(getValidationMessages("ar"));
    const result = schema.safeParse({
      name: "Alice",
      email: "alice@example.com",
      walletAddress: "GBADKEY",
    });
    expect(result.success).toBe(false);
    const msg = result.error?.issues.find((i) => i.path[0] === "walletAddress")?.message;
    expect(msg).toBe("تنسيق مفتاح Stellar العام غير صالح");
  });
});
