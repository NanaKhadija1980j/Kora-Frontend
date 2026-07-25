import { z } from "zod";
import type { Locale } from "@/i18n/config";

/**
 * Validation message translations for Zod schemas.
 * This module provides a factory function to create Zod error maps
 * that return localized error messages based on the active locale.
 */

export interface ValidationMessages {
  // Invoice details
  invoiceNumberRequired: string;
  invoiceNumberInvalid: string;
  debtorNameRequired: string;
  debtorNameMinLength: string;
  debtorAddressRequired: string;
  debtorAddressMinLength: string;
  amountPositive: string;
  amountMin: string;
  dueDateRequired: string;
  dueDateAfterIssueDate: string;
  descriptionMaxLength: string;
  discountRateMin: string;
  discountRateMax: string;
  minInvestmentPositive: string;
  minInvestmentMin: string;
  minInvestmentExceedsAmount: string;
  listingExpiryDateRequired: string;
  listingExpiryDateBeforeDueDate: string;
  fileRequired: string;
  fileType: string;
  fileSize: string;
  fundingAmountMinInvestment: string;
  fundingAmountExceedsCapacity: string;
  repaymentExactMatch: string;
  nameMinLength: string;
  emailInvalid: string;
  companyNameMinLength: string;
  walletAddressInvalid: string;
}

const enMessages: ValidationMessages = {
  invoiceNumberRequired: "Invoice number is required",
  invoiceNumberInvalid: "Invoice number must contain only alphanumeric characters and hyphens",
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
  minInvestmentExceedsAmount: "Minimum investment cannot exceed the total invoice amount",
  listingExpiryDateRequired: "Listing expiry date is required",
  listingExpiryDateBeforeDueDate: "Listing expiry date must be strictly earlier than the due date",
  fileRequired: "File is required",
  fileType: "Only PDF files are allowed",
  fileSize: "File size must not exceed 10MB",
  fundingAmountMinInvestment: "Funding amount must be at least the minimum investment amount",
  fundingAmountExceedsCapacity: "Funding amount cannot exceed the remaining capacity",
  repaymentExactMatch: "Repayment amount must exactly match the outstanding balance",
  nameMinLength: "Name must be at least 2 characters",
  emailInvalid: "Invalid email address",
  companyNameMinLength: "Company name must be at least 2 characters",
  walletAddressInvalid: "Invalid Stellar public key format",
};

const esMessages: ValidationMessages = {
  invoiceNumberRequired: "El número de factura es requerido",
  invoiceNumberInvalid: "El número de factura debe contener solo caracteres alfanuméricos y guiones",
  debtorNameRequired: "El nombre del deudor es requerido",
  debtorNameMinLength: "El nombre del deudor debe tener al menos 2 caracteres",
  debtorAddressRequired: "La dirección del deudor es requerida",
  debtorAddressMinLength: "La dirección del deudor debe tener al menos 5 caracteres",
  amountPositive: "El monto debe ser positivo",
  amountMin: "Mínimo 100 USDC",
  dueDateRequired: "La fecha de vencimiento es requerida",
  dueDateAfterIssueDate: "La fecha de vencimiento debe ser posterior a la fecha de emisión",
  descriptionMaxLength: "La descripción no puede exceder 200 caracteres",
  discountRateMin: "Mín 0.5%",
  discountRateMax: "Máx 20%",
  minInvestmentPositive: "La inversión mínima debe ser positiva",
  minInvestmentMin: "Mín $100",
  minInvestmentExceedsAmount: "La inversión mínima no puede exceder el monto total de la factura",
  listingExpiryDateRequired: "La fecha de expiración del listado es requerida",
  listingExpiryDateBeforeDueDate: "La fecha de expiración del listado debe ser estrictamente anterior a la fecha de vencimiento",
  fileRequired: "El archivo es requerido",
  fileType: "Solo se permiten archivos PDF",
  fileSize: "El tamaño del archivo no debe exceder 10MB",
  fundingAmountMinInvestment: "El monto de financiamiento debe ser al menos el monto de inversión mínima",
  fundingAmountExceedsCapacity: "El monto de financiamiento no puede exceder la capacidad restante",
  repaymentExactMatch: "El monto de pago debe coincidir exactamente con el saldo pendiente",
  nameMinLength: "El nombre debe tener al menos 2 caracteres",
  emailInvalid: "Dirección de correo electrónico inválida",
  companyNameMinLength: "El nombre de la empresa debe tener al menos 2 caracteres",
  walletAddressInvalid: "Formato de clave pública de Stellar inválido",
};

export function getValidationMessages(locale: Locale): ValidationMessages {
  return locale === "es" ? esMessages : enMessages;
}

/**
 * Creates a Zod error map that returns localized error messages.
 * Use this with Zod's .parse() or .safeParse() methods.
 */
export function createLocalizedErrorMap(locale: Locale) {
  const messages = getValidationMessages(locale);

  return (
    issue: z.ZodIssue,
    ctx: z.ErrorMapCtx
  ): { message: string } => {
    const code = issue.code;

    // Handle custom error messages first
    if (issue.message) {
      return { message: issue.message };
    }

    // Map Zod error codes to our localized messages
    switch (code) {
      case "too_small":
        if (issue.path.join(".") === "amount") {
          return { message: messages.amountMin };
        }
        if (issue.path.join(".") === "minInvestment") {
          return { message: messages.minInvestmentMin };
        }
        if (issue.minimum === 1) {
          return { message: `${ctx.defaultError}` };
        }
        if (issue.minimum === 2) {
          if (issue.path.join(".") === "name") return { message: messages.nameMinLength };
          if (issue.path.join(".") === "companyName") return { message: messages.companyNameMinLength };
          if (issue.path.join(".") === "debtorName") return { message: messages.debtorNameMinLength };
        }
        if (issue.minimum === 5) {
          return { message: messages.debtorAddressMinLength };
        }
        return { message: ctx.defaultError };

      case "invalid_string":
        if (issue.validation === "email") {
          return { message: messages.emailInvalid };
        }
        return { message: ctx.defaultError };

      case "invalid_type":
        if (issue.path.join(".") === "file") {
          return { message: messages.fileRequired };
        }
        return { message: ctx.defaultError };

      case "custom":
        return { message: issue.message || ctx.defaultError };

      default:
        return { message: ctx.defaultError };
    }
  };
}