import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvoiceAmendmentForm } from "@/components/invoice/InvoiceAmendmentForm";
import type { Invoice } from "@/types";

/**
 * Invoice amendment form (Issue #770).
 *
 * Two things decide whether this form is safe: that it refuses to render for
 * anyone who may not amend, and that it does not send an empty amendment —
 * which would re-pin identical metadata to IPFS and produce a new CID for no
 * change, quietly detaching the invoice from the CID the chain records.
 */

const { prepareAmendInvoiceMetadata } = vi.hoisted(() => ({
  prepareAmendInvoiceMetadata: vi.fn(),
}));

vi.mock("@/services/invoiceService", () => ({ prepareAmendInvoiceMetadata }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const OWNER = "GOWNERADDRESS0000000000000000000000000000000000000000000";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    status: "listed",
    ownerAddress: OWNER,
    metadata: {
      invoiceNumber: "INV-001",
      description: "Original description",
      category: "technology",
    },
    ...overrides,
  } as Invoice;
}

function renderForm(
  invoice: Invoice = makeInvoice(),
  ownerAddress: string = OWNER,
  withCancel = true,
) {
  const onSuccess = vi.fn();
  const onCancel = vi.fn();

  const utils = render(
    <InvoiceAmendmentForm
      invoice={invoice}
      ownerAddress={ownerAddress}
      onSuccess={onSuccess}
      {...(withCancel ? { onCancel } : {})}
    />,
  );

  return { ...utils, onSuccess, onCancel };
}

describe("InvoiceAmendmentForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareAmendInvoiceMetadata.mockResolvedValue("bafyNewCid");
  });

  describe("eligibility", () => {
    it("renders the form for an owner on a listed invoice", () => {
      renderForm();

      expect(screen.getByTestId("amendment-form")).toBeInTheDocument();
      expect(screen.queryByTestId("amendment-blocked")).not.toBeInTheDocument();
    });

    it("renders the form on a partially funded invoice", () => {
      renderForm(makeInvoice({ status: "partially_funded" }));
      expect(screen.getByTestId("amendment-form")).toBeInTheDocument();
    });

    it.each(["fully_funded", "active", "repaid", "defaulted", "cancelled"])(
      "blocks amendment once the invoice is %s",
      (status) => {
        renderForm(makeInvoice({ status } as Partial<Invoice>));

        expect(screen.getByTestId("amendment-blocked")).toBeInTheDocument();
        expect(screen.queryByTestId("amendment-form")).not.toBeInTheDocument();
      },
    );

    it("blocks anyone who is not the owner", () => {
      renderForm(makeInvoice(), "GSOMEONEELSE000000000000000000000000000000000000000000");

      expect(screen.getByTestId("amendment-blocked")).toBeInTheDocument();
      expect(screen.getByText(/Only the invoice owner/)).toBeInTheDocument();
    });

    it("blocks when no wallet address is supplied", () => {
      renderForm(makeInvoice(), "");
      expect(screen.getByTestId("amendment-blocked")).toBeInTheDocument();
    });

    it("matches the owner address case-insensitively", () => {
      // Addresses arrive from different sources with different casing; a
      // case-sensitive comparison would lock an owner out of their own invoice.
      renderForm(makeInvoice(), OWNER.toLowerCase());
      expect(screen.getByTestId("amendment-form")).toBeInTheDocument();
    });
  });

  describe("initial values", () => {
    it("pre-fills from the current metadata", () => {
      renderForm();

      expect(screen.getByLabelText("descriptionLabel")).toHaveValue("Original description");
      expect(screen.getByLabelText("categoryLabel")).toHaveValue("technology");
    });

    it("falls back to an empty description and the 'other' category", () => {
      renderForm(makeInvoice({ metadata: { invoiceNumber: "INV-002" } } as Partial<Invoice>));

      expect(screen.getByLabelText("descriptionLabel")).toHaveValue("");
      expect(screen.getByLabelText("categoryLabel")).toHaveValue("other");
    });

    it("counts the description against its 200-character limit", () => {
      renderForm();
      expect(screen.getByText("20/200")).toBeInTheDocument();
      expect(screen.getByLabelText("descriptionLabel")).toHaveAttribute("maxLength", "200");
    });
  });

  describe("validation", () => {
    it("refuses a submit with nothing changed", async () => {
      renderForm();

      fireEvent.submit(screen.getByTestId("amendment-form"));

      expect(await screen.findByTestId("amendment-error")).toHaveTextContent("noChanges");
      // The important half: no IPFS write for a no-op edit.
      expect(prepareAmendInvoiceMetadata).not.toHaveBeenCalled();
    });

    it("refuses a submit that edits a field and puts it back", async () => {
      renderForm();
      const description = screen.getByLabelText("descriptionLabel");

      fireEvent.change(description, { target: { value: "Something else" } });
      fireEvent.change(description, { target: { value: "Original description" } });
      fireEvent.submit(screen.getByTestId("amendment-form"));

      expect(await screen.findByTestId("amendment-error")).toBeInTheDocument();
      expect(prepareAmendInvoiceMetadata).not.toHaveBeenCalled();
    });

    it("clears a previous error on the next submit", async () => {
      renderForm();

      fireEvent.submit(screen.getByTestId("amendment-form"));
      expect(await screen.findByTestId("amendment-error")).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("descriptionLabel"), {
        target: { value: "Corrected wording" },
      });
      fireEvent.submit(screen.getByTestId("amendment-form"));

      await waitFor(() =>
        expect(screen.queryByTestId("amendment-error")).not.toBeInTheDocument(),
      );
    });
  });

  describe("submission", () => {
    it("sends only the fields that actually changed", async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText("descriptionLabel"), {
        target: { value: "Corrected wording" },
      });
      fireEvent.submit(screen.getByTestId("amendment-form"));

      await waitFor(() => expect(prepareAmendInvoiceMetadata).toHaveBeenCalledTimes(1));
      expect(prepareAmendInvoiceMetadata).toHaveBeenCalledWith(
        "invoice-1",
        "listed",
        OWNER,
        // Not `{ description, category }` — an unchanged category must not be
        // re-sent as if it were an edit.
        { description: "Corrected wording" },
      );
    });

    it("sends both fields when both changed", async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText("descriptionLabel"), {
        target: { value: "New text" },
      });
      fireEvent.change(screen.getByLabelText("categoryLabel"), {
        target: { value: "logistics" },
      });
      fireEvent.submit(screen.getByTestId("amendment-form"));

      await waitFor(() =>
        expect(prepareAmendInvoiceMetadata).toHaveBeenCalledWith("invoice-1", "listed", OWNER, {
          description: "New text",
          category: "logistics",
        }),
      );
    });

    it("reports the new CID and hands it to the parent", async () => {
      const { onSuccess } = renderForm();

      fireEvent.change(screen.getByLabelText("descriptionLabel"), {
        target: { value: "Corrected wording" },
      });
      fireEvent.submit(screen.getByTestId("amendment-form"));

      expect(await screen.findByTestId("amendment-success")).toHaveTextContent("bafyNewCid");
      expect(onSuccess).toHaveBeenCalledWith("bafyNewCid");
      expect(screen.queryByTestId("amendment-form")).not.toBeInTheDocument();
    });

    it("surfaces the service's error message", async () => {
      prepareAmendInvoiceMetadata.mockRejectedValue(new Error("IPFS pin failed"));
      const { onSuccess } = renderForm();

      fireEvent.change(screen.getByLabelText("descriptionLabel"), {
        target: { value: "Corrected wording" },
      });
      fireEvent.submit(screen.getByTestId("amendment-form"));

      expect(await screen.findByTestId("amendment-error")).toHaveTextContent("IPFS pin failed");
      expect(onSuccess).not.toHaveBeenCalled();
      // The form stays up so the edit is not lost.
      expect(screen.getByTestId("amendment-form")).toBeInTheDocument();
    });

    it("falls back to a generic message for a non-Error rejection", async () => {
      prepareAmendInvoiceMetadata.mockRejectedValue("something odd");
      renderForm();

      fireEvent.change(screen.getByLabelText("descriptionLabel"), {
        target: { value: "Corrected wording" },
      });
      fireEvent.submit(screen.getByTestId("amendment-form"));

      expect(await screen.findByTestId("amendment-error")).toHaveTextContent("unknownError");
    });

    it("re-enables the inputs after a failure", async () => {
      prepareAmendInvoiceMetadata.mockRejectedValue(new Error("IPFS pin failed"));
      renderForm();

      fireEvent.change(screen.getByLabelText("descriptionLabel"), {
        target: { value: "Corrected wording" },
      });
      fireEvent.submit(screen.getByTestId("amendment-form"));

      await screen.findByTestId("amendment-error");
      // A form left disabled after an error is a dead end.
      expect(screen.getByLabelText("descriptionLabel")).not.toBeDisabled();
      expect(screen.getByRole("button", { name: "submit" })).not.toBeDisabled();
    });
  });

  describe("cancel", () => {
    it("calls onCancel without submitting", () => {
      const { onCancel } = renderForm();

      fireEvent.click(screen.getByRole("button", { name: "cancel" }));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(prepareAmendInvoiceMetadata).not.toHaveBeenCalled();
    });

    it("omits the cancel button when no handler is given", () => {
      renderForm(makeInvoice(), OWNER, false);
      expect(screen.queryByRole("button", { name: "cancel" })).not.toBeInTheDocument();
    });
  });
});
