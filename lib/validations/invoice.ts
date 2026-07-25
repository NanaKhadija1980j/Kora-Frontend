import { z } from "zod";

/** Step 1 — invoice details (USDC only) */
export const invoiceDetailsStepSchema = z.object({
  invoiceNumber: z
    .string()
    .min(1, "Invoice number is required")
    .regex(/^[a-zA-Z0-9-]+$/, "Invoice number must contain only alphanumeric characters and hyphens"),
  debtorName: z.string().min(2, "Debtor name is required"),
  debtorAddress: z.string().min(5, "Debtor address is required"),
  amount: z.coerce.number().positive("Amount must be positive").min(100, "Minimum $100 USDC"),
  dueDate: z.string().min(1, "Due date is required"),
  description: z.string().max(200, "Description cannot exceed 200 characters").optional(),
  jurisdiction: z.enum(["US", "EU", "UK", "NG", "KE", "GH", "ZA", "OTHER"]),
  category: z.enum([
    "technology",
    "manufacturing",
    "logistics",
    "healthcare",
    "retail",
    "construction",
    "agriculture",
    "energy",
    "finance",
    "other",
  ]),
  debtorPrivacy: z.enum(["full", "partial", "anonymized"]),
});

export const invoiceDetailsSchema = invoiceDetailsStepSchema;
export type InvoiceDetailsStepSchema = z.infer<typeof invoiceDetailsStepSchema>;
export type InvoiceDetailsFormData = InvoiceDetailsStepSchema;

export const INVOICE_DETAILS_STEP_FIELDS = [
  "invoiceNumber",
  "debtorName",
  "debtorAddress",
  "amount",
  "dueDate",
  "description",
  "jurisdiction",
  "category",
  "debtorPrivacy",
] as const satisfies readonly (keyof InvoiceDetailsStepSchema)[];

/** Step 2 — Financing Terms */
export const financingTermsSchema = z
  .object({
    amount: z.coerce.number().positive("Amount must be positive"),
    dueDate: z.string().min(1, "Due date is required"),
    discountRate: z.coerce
      .number()
      .min(0.5, "Min 0.5%")
      .max(20, "Max 20%"),
    minInvestment: z.coerce.number().positive("Minimum investment must be positive").min(100, "Min $100"),
    listingExpiryDate: z.string().min(1, "Listing expiry date is required"),
  })
  .refine(
    (d) => d.minInvestment <= d.amount,
    {
      message: "Minimum investment cannot exceed the total invoice amount",
      path: ["minInvestment"],
    }
  )
  .refine(
    (d) => {
      if (!d.listingExpiryDate || !d.dueDate) return true;
      const due = new Date(d.dueDate);
      const expiry = new Date(d.listingExpiryDate);
      return expiry < due;
    },
    {
      message: "Listing expiry date must be strictly earlier than the due date",
      path: ["listingExpiryDate"],
    }
  );

export type FinancingTermsFormData = z.infer<typeof financingTermsSchema>;

export const FINANCING_TERMS_STEP_FIELDS = [
  "discountRate",
  "minInvestment",
  "listingExpiryDate",
] as const satisfies readonly (keyof FinancingTermsFormData)[];

/** Step 3 — File Upload */
export const uploadSchema = z.object({
  file: z
    .custom<File | null | undefined>()
    .refine((file) => file !== null && file !== undefined, "File is required")
    .refine(
      (file) => {
        if (!file) return false;
        if (typeof file.type === "string") {
          return file.type === "application/pdf";
        }
        if (typeof file.name === "string") {
          return file.name.toLowerCase().endsWith(".pdf");
        }
        return false;
      },
      "Only PDF files are allowed"
    )
    .refine(
      (file) => {
        if (!file) return false;
        if (typeof file.size === "number") {
          return file.size <= 10 * 1024 * 1024; // 10MB
        }
        return true;
      },
      "File size must not exceed 10MB"
    ),
});

export type UploadFormData = z.infer<typeof uploadSchema>;

/** Funding Amount Input */
export const fundingAmountSchema = z
  .object({
    amount: z.coerce.number().positive("Amount must be positive"),
    minInvestment: z.coerce.number().positive(),
    remainingCapacity: z.coerce.number().nonnegative(),
  })
  .refine(
    (d) => d.amount >= d.minInvestment,
    {
      message: "Funding amount must be at least the minimum investment amount",
      path: ["amount"],
    }
  )
  .refine(
    (d) => d.amount <= d.remainingCapacity,
    {
      message: "Funding amount cannot exceed the remaining capacity",
      path: ["amount"],
    }
  );

export type FundingAmountFormData = z.infer<typeof fundingAmountSchema>;

/** Repayment Input */
export const repaymentSchema = z
  .object({
    amount: z.coerce.number().positive("Amount must be positive"),
    outstandingBalance: z.coerce.number().nonnegative(),
  })
  .refine(
    (d) => Math.abs(d.amount - d.outstandingBalance) < 0.01,
    {
      message: "Repayment amount must exactly match the outstanding balance",
      path: ["amount"],
    }
  );

export type RepaymentFormData = z.infer<typeof repaymentSchema>;

/** User Profile */
export const userProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  companyName: z.string().min(2, "Company name must be at least 2 characters").optional().or(z.literal("")),
  walletAddress: z.string().regex(/^G[A-Z0-9]{55}$/, "Invalid Stellar public key format"),
});

export type UserProfileFormData = z.infer<typeof userProfileSchema>;

/** Combined Form Schema */
export const createInvoiceSchema = z
  .object({
    invoiceNumber: z
      .string()
      .min(1, "Invoice number is required")
      .regex(/^[a-zA-Z0-9-]+$/, "Invoice number must contain only alphanumeric characters and hyphens"),
    debtorName: z.string().min(2, "Debtor name is required"),
    debtorAddress: z.string().min(5, "Debtor address is required"),
    amount: z.coerce.number().positive("Amount must be positive").min(100, "Minimum $100"),
    currency: z.enum(["USDC", "EURC", "XLM"]),
    issueDate: z.string().min(1, "Issue date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    description: z.string().max(200, "Description cannot exceed 200 characters").optional(),
    jurisdiction: z.enum(["US", "EU", "UK", "NG", "KE", "GH", "ZA", "OTHER"]),
    category: z.enum([
      "technology",
      "manufacturing",
      "logistics",
      "healthcare",
      "retail",
      "construction",
      "agriculture",
      "energy",
      "finance",
      "other",
    ]),
    debtorPrivacy: z.enum(["full", "partial", "anonymized"]),
    discountRate: z.coerce
      .number()
      .min(0.5, "Min 0.5%")
      .max(20, "Max 20%")
      .transform((v) => v / 100), // store as decimal
    minInvestment: z.coerce.number().positive().min(100, "Min $100"),
    listingExpiryDate: z.string().min(1, "Listing expiry date is required"),
  })
  .refine(
    (d) => {
      if (!d.dueDate || !d.issueDate) return true;
      const due = new Date(d.dueDate);
      const issue = new Date(d.issueDate);
      return due > issue;
    },
    {
      message: "Due date must be after issue date",
      path: ["dueDate"],
    }
  )
  .refine(
    (d) => {
      if (d.minInvestment === undefined || d.amount === undefined) return true;
      return d.minInvestment <= d.amount;
    },
    {
      message: "Minimum investment cannot exceed the total invoice amount",
      path: ["minInvestment"],
    }
  )
  .refine(
    (d) => {
      if (!d.listingExpiryDate || !d.dueDate) return true;
      const due = new Date(d.dueDate);
      const expiry = new Date(d.listingExpiryDate);
      return expiry < due;
    },
    {
      message: "Listing expiry date must be strictly earlier than the due date",
      path: ["listingExpiryDate"],
    }
  );

export type CreateInvoiceSchema = z.infer<typeof createInvoiceSchema>;
