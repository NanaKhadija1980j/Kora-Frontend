import { z } from "zod";
import type { Locale } from "@/i18n/config";

/**
 * Validation message translations for Zod schemas.
 *
 * Each locale provides the full set of human-readable error messages used by
 * the invoice wizard schemas.  The factory `buildInvoiceSchemas(msgs)` in
 * invoice.ts consumes these objects so every Zod error string is locale-aware
 * at schema-construction time.
 *
 * `createLocalizedErrorMap` is kept for any remaining ad-hoc usage (e.g.
 * outside the wizard) but is superseded by the schema-factory pattern.
 */

/**
 * Locale-specific formatting configuration for numbers, currency, and dates.
 * Ensures consistent display across the 4 supported application locales.
 */
export interface LocaleFormatConfig {
  /** BCP 47 locale tag used for Intl.NumberFormat / Intl.DateTimeFormat */
  intlTag: string;
  /** Whether the locale uses a Latin or Arabic-Indic numbering system */
  numberingSystem?: "latn" | "arab";
  /** Expected thousands separator for quick validation */
  thousandsSep: string;
  /** Expected decimal separator for quick validation */
  decimalSep: string;
  /** Date order in short format patterns */
  dateOrder: "MDY" | "DMY" | "YMD";
  /** Whether the locale is RTL (right-to-left) */
  rtl: boolean;
  /** Locale-specific example strings (for tooltips/placeholders) */
  examples: {
    currency: string;
    dateShort: string;
    percentage: string;
  };
}

/** Supported application locales with their formatting characteristics. */
export const LOCALE_FORMATS: Record<Locale, LocaleFormatConfig> = {
  en: {
    intlTag: "en-US",
    numberingSystem: "latn",
    thousandsSep: ",",
    decimalSep: ".",
    dateOrder: "MDY",
    rtl: false,
    examples: {
      currency: "$1,234.56 USDC",
      dateShort: "Jan 15, 2025",
      percentage: "12.50%",
    },
  },
  es: {
    intlTag: "es-ES",
    numberingSystem: "latn",
    thousandsSep: ".",
    decimalSep: ",",
    dateOrder: "DMY",
    rtl: false,
    examples: {
      currency: "$1.234,56 USDC",
      dateShort: "15 ene 2025",
      percentage: "12,50 %",
    },
  },
  ar: {
    intlTag: "ar-SA",
    numberingSystem: "arab",
    thousandsSep: "٬",
    decimalSep: "٫",
    dateOrder: "DMY",
    rtl: true,
    examples: {
      currency: "١٬٢٣٤٫٥٦ $ USDC",
      dateShort: "١٥ جمادى الأولى ٢٠٢٥",
      percentage: "١٢٫٥٠٪",
    },
  },
  "pt-BR": {
    intlTag: "pt-BR",
    numberingSystem: "latn",
    thousandsSep: ".",
    decimalSep: ",",
    dateOrder: "DMY",
    rtl: false,
    examples: {
      currency: "$1.234,56 USDC",
      dateShort: "15 de jan. de 2025",
      percentage: "12,50%",
    },
  },
};

/** Resolve the canonical Intl tag for an app locale. */
export function getIntlTag(locale: Locale): string {
  return LOCALE_FORMATS[locale]?.intlTag ?? locale;
}

/** Return the locale formatting config for a given locale code. */
export function getLocaleFormatConfig(locale: string): LocaleFormatConfig {
  const key = Object.keys(LOCALE_FORMATS).find(
    (k) => k === locale || (LOCALE_FORMATS as Record<string, LocaleFormatConfig>)[k]?.intlTag === locale,
  ) as Locale | undefined;
  return LOCALE_FORMATS[key ?? "en"];
}

export interface ValidationMessages {
  // Invoice number
  invoiceNumberRequired: string;
  invoiceNumberInvalid: string;
  // Debtor
  debtorNameRequired: string;
  debtorNameMinLength: string;
  debtorAddressRequired: string;
  debtorAddressMinLength: string;
  // Amount / dates
  amountPositive: string;
  amountMin: string;
  dueDateRequired: string;
  dueDateAfterIssueDate: string;
  // Description
  descriptionMaxLength: string;
  // Financing terms
  discountRateMin: string;
  discountRateMax: string;
  minInvestmentPositive: string;
  minInvestmentMin: string;
  minInvestmentExceedsAmount: string;
  listingExpiryDateRequired: string;
  listingExpiryDateBeforeDueDate: string;
  // File upload
  fileRequired: string;
  fileType: string;
  fileSize: string;
  // Funding / repayment
  fundingAmountMinInvestment: string;
  fundingAmountExceedsCapacity: string;
  repaymentExactMatch: string;
  // User profile
  nameMinLength: string;
  emailInvalid: string;
  companyNameMinLength: string;
  walletAddressInvalid: string;
}

// ─── English ──────────────────────────────────────────────────────────────────

const enMessages: ValidationMessages = {
  invoiceNumberRequired: "Invoice number is required",
  invoiceNumberInvalid:
    "Invoice number must contain only alphanumeric characters and hyphens",
  debtorNameRequired: "Debtor name is required",
  debtorNameMinLength: "Debtor name must be at least 2 characters",
  debtorAddressRequired: "Debtor address is required",
  debtorAddressMinLength: "Debtor address must be at least 5 characters",
  amountPositive: "Amount must be positive",
  amountMin: "Minimum $100 USDC",
  dueDateRequired: "Due date is required",
  dueDateAfterIssueDate: "Due date must be after issue date",
  descriptionMaxLength: "Description cannot exceed 200 characters",
  discountRateMin: "Min 0.5%",
  discountRateMax: "Max 20%",
  minInvestmentPositive: "Minimum investment must be positive",
  minInvestmentMin: "Min $100",
  minInvestmentExceedsAmount:
    "Minimum investment cannot exceed the total invoice amount",
  listingExpiryDateRequired: "Listing expiry date is required",
  listingExpiryDateBeforeDueDate:
    "Listing expiry date must be strictly earlier than the due date",
  fileRequired: "File is required",
  fileType: "Only PDF files are allowed",
  fileSize: "File size must not exceed 10MB",
  fundingAmountMinInvestment:
    "Funding amount must be at least the minimum investment amount",
  fundingAmountExceedsCapacity:
    "Funding amount cannot exceed the remaining capacity",
  repaymentExactMatch:
    "Repayment amount must exactly match the outstanding balance",
  nameMinLength: "Name must be at least 2 characters",
  emailInvalid: "Invalid email address",
  companyNameMinLength: "Company name must be at least 2 characters",
  walletAddressInvalid: "Invalid Stellar public key format",
};

// ─── Spanish ──────────────────────────────────────────────────────────────────

const esMessages: ValidationMessages = {
  invoiceNumberRequired: "El número de factura es requerido",
  invoiceNumberInvalid:
    "El número de factura debe contener solo caracteres alfanuméricos y guiones",
  debtorNameRequired: "El nombre del deudor es requerido",
  debtorNameMinLength: "El nombre del deudor debe tener al menos 2 caracteres",
  debtorAddressRequired: "La dirección del deudor es requerida",
  debtorAddressMinLength:
    "La dirección del deudor debe tener al menos 5 caracteres",
  amountPositive: "El monto debe ser positivo",
  amountMin: "Mínimo 100 USDC",
  dueDateRequired: "La fecha de vencimiento es requerida",
  dueDateAfterIssueDate:
    "La fecha de vencimiento debe ser posterior a la fecha de emisión",
  descriptionMaxLength: "La descripción no puede exceder 200 caracteres",
  discountRateMin: "Mín 0.5%",
  discountRateMax: "Máx 20%",
  minInvestmentPositive: "La inversión mínima debe ser positiva",
  minInvestmentMin: "Mín $100",
  minInvestmentExceedsAmount:
    "La inversión mínima no puede exceder el monto total de la factura",
  listingExpiryDateRequired:
    "La fecha de expiración del listado es requerida",
  listingExpiryDateBeforeDueDate:
    "La fecha de expiración del listado debe ser estrictamente anterior a la fecha de vencimiento",
  fileRequired: "El archivo es requerido",
  fileType: "Solo se permiten archivos PDF",
  fileSize: "El tamaño del archivo no debe exceder 10MB",
  fundingAmountMinInvestment:
    "El monto de financiamiento debe ser al menos el monto de inversión mínima",
  fundingAmountExceedsCapacity:
    "El monto de financiamiento no puede exceder la capacidad restante",
  repaymentExactMatch:
    "El monto de pago debe coincidir exactamente con el saldo pendiente",
  nameMinLength: "El nombre debe tener al menos 2 caracteres",
  emailInvalid: "Dirección de correo electrónico inválida",
  companyNameMinLength:
    "El nombre de la empresa debe tener al menos 2 caracteres",
  walletAddressInvalid: "Formato de clave pública de Stellar inválido",
};

const arMessages: ValidationMessages = {
  invoiceNumberRequired: "رقم الفاتورة مطلوب",
  invoiceNumberInvalid: "يجب أن يحتوي رقم الفاتورة على أحرف وأرقام وشرطات فقط",
  debtorNameRequired: "اسم المدين مطلوب",
  debtorNameMinLength: "يجب أن يبلغ اسم المدين حرفين على الأقل",
  debtorAddressRequired: "عنوان المدين مطلوب",
  debtorAddressMinLength: "يجب أن يبلغ عنوان المدين 5 أحرف على الأقل",
  amountPositive: "يجب أن يكون المبلغ موجبًا",
  amountMin: "الحد الأدنى 100 USDC",
  dueDateRequired: "تاريخ الاستحقاق مطلوب",
  dueDateAfterIssueDate: "يجب أن يكون تاريخ الاستحقاق بعد تاريخ الإصدار",
  descriptionMaxLength: "لا يمكن أن تتجاوز الوصف 200 حرف",
  discountRateMin: "الحد الأدنى 0.5%",
  discountRateMax: "الحد الأقصى 20%",
  minInvestmentPositive: "يجب أن يكون الحد الأدنى للاستثمار موجبًا",
  minInvestmentMin: "الحد الأدنى 100$",
  minInvestmentExceedsAmount: "لا يمكن أن يتجاوز الحد الأدنى للاستثمار إجمالي قيمة الفاتورة",
  listingExpiryDateRequired: "تاريخ انتهاء صلاحية القائمة مطلوب",
  listingExpiryDateBeforeDueDate: "يجب أن يكون تاريخ انتهاء الإدراج قبل تاريخ الاستحقاق",
  fileRequired: "الملف مطلوب",
  fileType: "يُسمح فقط بملفات PDF",
  fileSize: "يجب ألا يتجاوز حجم الملف 10 ميجابايت",
  fundingAmountMinInvestment: "يجب أن يكون مبلغ التمويل على الأقل الحد الأدنى لمبلغ الاستثمار",
  fundingAmountExceedsCapacity: "لا يمكن أن يتجاوز مبلغ التمويل الطاقة المتبقية",
  repaymentExactMatch: "يجب أن يتطابق مبلغ السداد تمامًا مع الرصيد المستحق",
  nameMinLength: "يجب أن يبلغ الاسم حرفين على الأقل",
  emailInvalid: "عنوان البريد الإلكتروني غير صالح",
  companyNameMinLength: "يجب أن يبلغ اسم الشركة حرفين على الأقل",
  walletAddressInvalid: "تنسيق مفتاح Stellar العام غير صالح",
};

const ptBrMessages: ValidationMessages = {
  invoiceNumberRequired: "O número da fatura é obrigatório",
  invoiceNumberInvalid: "O número da fatura deve conter apenas caracteres alfanuméricos e hifens",
  debtorNameRequired: "O nome do devedor é obrigatório",
  debtorNameMinLength: "O nome do devedor deve ter pelo menos 2 caracteres",
  debtorAddressRequired: "O endereço do devedor é obrigatório",
  debtorAddressMinLength: "O endereço do devedor deve ter pelo menos 5 caracteres",
  amountPositive: "O valor deve ser positivo",
  amountMin: "Mínimo $100 USDC",
  dueDateRequired: "A data de vencimento é obrigatória",
  dueDateAfterIssueDate: "A data de vencimento deve ser posterior à data de emissão",
  descriptionMaxLength: "A descrição não pode exceder 200 caracteres",
  discountRateMin: "Mín 0,5%",
  discountRateMax: "Máx 20%",
  minInvestmentPositive: "O investimento mínimo deve ser positivo",
  minInvestmentMin: "Mín R$100",
  minInvestmentExceedsAmount: "O investimento mínimo não pode exceder o valor total da fatura",
  listingExpiryDateRequired: "A data de expiração da listagem é obrigatória",
  listingExpiryDateBeforeDueDate: "A data de expiração da listagem deve ser estritamente anterior à data de vencimento",
  fileRequired: "O arquivo é obrigatório",
  fileType: "Apenas arquivos PDF são permitidos",
  fileSize: "O tamanho do arquivo não deve exceder 10MB",
  fundingAmountMinInvestment: "O valor do financiamento deve ser pelo menos o valor do investimento mínimo",
  fundingAmountExceedsCapacity: "O valor do financiamento não pode exceder a capacidade restante",
  repaymentExactMatch: "O valor do reembolso deve corresponder exatamente ao saldo pendente",
  nameMinLength: "O nome deve ter pelo menos 2 caracteres",
  emailInvalid: "Endereço de e-mail inválido",
  companyNameMinLength: "O nome da empresa deve ter pelo menos 2 caracteres",
  walletAddressInvalid: "Formato de chave pública Stellar inválido",
};

export function getValidationMessages(locale: Locale): ValidationMessages {
  switch (locale) {
    case "es":
      return esMessages;
    case "ar":
      return arMessages;
    case "pt-BR":
      return ptBrMessages;
    default:
      return enMessages;
  }
}

// ─── Zod error-map (ad-hoc usage) ────────────────────────────────────────────

/**
 * Creates a Zod `ZodErrorMap` that overrides messages using the locale-specific
 * message set.  Intended for ad-hoc schema usage outside the wizard.
 *
 * NOTE: The invoice wizard uses the schema-factory pattern (`buildInvoiceSchemas`)
 * which bakes messages directly into schema definitions, so this error map is
 * NOT required there.
 */

export function createLocalizedErrorMap(locale: Locale): z.ZodErrorMap {
  const messages = getValidationMessages(locale);

  return (issue, ctx): { message: string } => {
    switch (issue.code) {
      case z.ZodIssueCode.too_small: {
        const path = issue.path.join(".");
        if (issue.type === "number") {
          if (path === "amount" || path === "amount") return { message: messages.amountMin };
          if (path === "minInvestment") return { message: messages.minInvestmentMin };
          if (path === "discountRate" && issue.minimum === 0.5)
            return { message: messages.discountRateMin };
        }
        if (issue.type === "string") {
          if (path === "invoiceNumber") return { message: messages.invoiceNumberRequired };
          if (path === "debtorName") return { message: messages.debtorNameRequired };
          if (path === "debtorAddress") return { message: messages.debtorAddressRequired };
          if (path === "dueDate") return { message: messages.dueDateRequired };
          if (path === "listingExpiryDate")
            return { message: messages.listingExpiryDateRequired };
          if (path === "name") return { message: messages.nameMinLength };
          if (path === "companyName") return { message: messages.companyNameMinLength };
        }
        return { message: ctx.defaultError };
      }

      case z.ZodIssueCode.too_big: {
        const path = issue.path.join(".");
        if (path === "discountRate" && issue.maximum === 20)
          return { message: messages.discountRateMax };
        if (path === "description") return { message: messages.descriptionMaxLength };
        return { message: ctx.defaultError };
      }

      case z.ZodIssueCode.invalid_string: {
        if (issue.validation === "email") return { message: messages.emailInvalid };
        if (issue.validation === "regex") {
          const path = issue.path.join(".");
          if (path === "invoiceNumber") return { message: messages.invoiceNumberInvalid };
          if (path === "walletAddress") return { message: messages.walletAddressInvalid };
        }
        return { message: ctx.defaultError };
      }

      case z.ZodIssueCode.custom: {
        // Refinement errors — fall through to ctx.defaultError so schema-embedded
        // messages (already localised by the factory) are preserved.
        return { message: issue.message ?? ctx.defaultError };
      }

      default:
        return { message: ctx.defaultError };
    }
  };
}
