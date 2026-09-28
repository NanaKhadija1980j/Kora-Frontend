/**
 * Component tests for FeedbackWidget.
 *
 * Covers:
 *  - Zod validation field errors on invalid submit
 *  - Successful submit posts correct payload and closes the panel
 *  - Screenshot capture failure still allows submit
 *  - Wallet address attachment remains optional
 *  - No real network calls (fetch mocked)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";

const FEEDBACK_MESSAGES: Record<string, string> = {
  sendFeedback: "Send Feedback",
  openLabel: "Open feedback form",
  closeLabel: "Close feedback form",
  ariaLabel: "Feedback form",
  typeLabel: "Type",
  fieldTitle: "Title",
  fieldTitlePlaceholder: "Brief summary…",
  fieldDescription: "Description",
  fieldDescriptionPlaceholder: "Describe the issue or idea in detail…",
  screenshotLabel: "Screenshot (optional)",
  captureScreen: "Capture screen",
  uploadImage: "Upload image",
  screenshotAlt: "Attached screenshot preview",
  removeScreenshot: "Remove screenshot",
  contextNote: "Your current URL, browser info{wallet} will be included automatically.",
  contextWallet: ", and wallet address",
  cancel: "Cancel",
  submit: "Submit",
  successMessage: "Feedback submitted — thanks for helping improve Kora!",
  submitFailed: "Failed to submit feedback",
  submissionFailed: "Submission failed",
  invalidImageType: "Please upload an image file",
  imageTooLarge: "Screenshot must be under 5 MB",
  "types.bug": "Bug Report",
  "types.feature": "Feature Request",
  "types.improvement": "Improvement",
  "types.other": "Other",
  "validation.titleMin": "Title must be at least 3 characters",
  "validation.descriptionMin": "Please provide more detail",
};

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    if (namespace === "common") {
      return (key: string) => (key === "close" ? "Close" : key);
    }
    return (key: string, values?: Record<string, string>) => {
      const template = FEEDBACK_MESSAGES[key] ?? key;
      if (!values) return template;
      return Object.entries(values).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, v),
        template
      );
    };
  },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

let mockWalletAddress: string | null = null;
vi.mock("@/store/walletStore", () => ({
  useWalletStore: (selector: (s: { address: string | null }) => unknown) =>
    selector({ address: mockWalletAddress }),
}));

const html2canvasMock = vi.fn();
vi.mock("html2canvas", () => ({
  default: (...args: unknown[]) => html2canvasMock(...args),
}));

describe("FeedbackWidget", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    mockWalletAddress = null;
    fetchMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    html2canvasMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function openPanel(user: ReturnType<typeof userEvent.setup>) {
    render(<FeedbackWidget />);
    await user.click(screen.getByLabelText("Open feedback form"));
    return screen.getByRole("dialog", { name: "Feedback form" });
  }

  it("renders localized feedback type labels", async () => {
    const user = userEvent.setup();
    const panel = await openPanel(user);

    expect(within(panel).getByText("Bug Report")).toBeInTheDocument();
    expect(within(panel).getByText("Feature Request")).toBeInTheDocument();
    expect(within(panel).getByText("Improvement")).toBeInTheDocument();
    expect(within(panel).getByText("Other")).toBeInTheDocument();
  });

  it("shows zod field errors when title and description are too short", async () => {
    const user = userEvent.setup();
    const panel = await openPanel(user);

    await user.type(within(panel).getByLabelText(/Title/), "ab");
    await user.type(within(panel).getByLabelText(/Description/), "short");
    await user.click(within(panel).getByRole("button", { name: "Submit" }));

    expect(await within(panel).findByText("Title must be at least 3 characters")).toBeInTheDocument();
    expect(within(panel).getByText("Please provide more detail")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits the correct payload shape and closes the panel on success", async () => {
    const user = userEvent.setup();
    mockWalletAddress = "GTESTWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const panel = await openPanel(user);

    await user.type(within(panel).getByLabelText(/Title/), "Broken submit button");
    await user.type(
      within(panel).getByLabelText(/Description/),
      "The feedback submit button does nothing on mobile Safari."
    );
    await user.click(within(panel).getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/feedback",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      type: "bug",
      title: "Broken submit button",
      description: "The feedback submit button does nothing on mobile Safari.",
      screenshot: null,
      context: {
        walletAddress: "GTESTWALLETADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      },
    });
    expect(body.context.url).toBeTruthy();
    expect(body.context.userAgent).toBeTruthy();
    expect(body.context.timestamp).toBeTruthy();

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Feedback submitted — thanks for helping improve Kora!"
      );
    });
    expect(screen.queryByRole("dialog", { name: "Feedback form" })).not.toBeInTheDocument();
  });

  it("allows submit when screenshot capture fails", async () => {
    const user = userEvent.setup();
    html2canvasMock.mockRejectedValue(new Error("canvas blocked"));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const panel = await openPanel(user);

    await user.click(within(panel).getByRole("button", { name: "Capture screen" }));

    await waitFor(() => {
      expect(html2canvasMock).toHaveBeenCalled();
    });

    // Panel reopens after capture attempt; screenshot stays null on failure
    const reopened = await screen.findByRole("dialog", { name: "Feedback form" });
    expect(within(reopened).queryByAltText("Attached screenshot preview")).not.toBeInTheDocument();

    await user.type(within(reopened).getByLabelText(/Title/), "Capture failed case");
    await user.type(
      within(reopened).getByLabelText(/Description/),
      "Submit should still work when html2canvas throws."
    );
    await user.click(within(reopened).getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.screenshot).toBeNull();
    expect(body.context.walletAddress).toBeNull();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Feedback form" })).not.toBeInTheDocument();
    });
  });

  it("omits wallet address when wallet is disconnected", async () => {
    const user = userEvent.setup();
    mockWalletAddress = null;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const panel = await openPanel(user);
    await user.type(within(panel).getByLabelText(/Title/), "Optional wallet");
    await user.type(
      within(panel).getByLabelText(/Description/),
      "Wallet address should remain optional on the payload."
    );
    await user.click(within(panel).getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.context.walletAddress).toBeNull();
  });
});
