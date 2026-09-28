import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import OnboardingTour, { TOUR_STORAGE_KEY } from "../OnboardingTour";
import { useSettingsStore, DEFAULT_TOUR_SETTINGS } from "@/store/settingsStore";
import { useFeatureFlag } from "@/lib/featureFlags";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/marketplace",
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, options?: Record<string, unknown>) => {
    if (key === "step") return `Step ${options?.current} of ${options?.total}`;
    if (key === "steps.findOpportunityTitle") return "Find the right opportunity";
    if (key === "steps.findOpportunityBody") return "Search by debtor, invoice number, or jurisdiction to narrow the marketplace.";
    if (key === "steps.reviewDetailsTitle") return "Review invoice details";
    if (key === "steps.reviewDetailsBody") return "Each card summarizes the amount, return, risk tier, funding progress, and maturity.";
    if (key === "steps.fundInvoiceTitle") return "Fund an invoice";
    if (key === "steps.fundInvoiceBody") return "Open an eligible listing from its funding action when you are ready to invest.";
    if (key === "steps.trackPortfolioTitle") return "Track your portfolio";
    if (key === "steps.trackPortfolioBody") return "Use the investor dashboard to monitor positions, repayments, and earned yield.";
    if (key === "steps.viewAnalyticsTitle") return "Explore portfolio analytics";
    if (key === "steps.viewAnalyticsBody") return "Dive into charts, yield projections, vintage cohorts, and export your full portfolio data from the Analytics page.";
    if (key === "steps.mintInvoiceTitle") return "Mint an invoice";
    if (key === "steps.mintInvoiceBody") return "Upload unpaid invoice details and mint a Soroban NFT to request financing.";
    if (key === "steps.smeDashboardTitle") return "SME Dashboard";
    if (key === "steps.smeDashboardBody") return "Track your minted invoices, funding progress, and upcoming repayments.";
    if (key === "personaInvestor") return "Investor";
    if (key === "personaSme") return "SME";
    if (key === "selectPersona") return "Select persona";
    if (key === "skipTour") return "Skip tour";
    if (key === "skipLabel") return "Skip onboarding tour";
    if (key === "back") return "Back";
    if (key === "next") return "Next";
    if (key === "finish") return "Finish";
    return key;
  },
}));

// Mock featureFlags
vi.mock("@/lib/featureFlags", () => ({
  useFeatureFlag: vi.fn(),
}));

describe("OnboardingTour Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // JSDOM does not implement scrollIntoView; stub it so TourTooltip
    // does not throw when it finds a real DOM anchor element.
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    localStorage.removeItem(TOUR_STORAGE_KEY);
    useSettingsStore.setState({
      tour: { ...DEFAULT_TOUR_SETTINGS },
    });
    vi.mocked(useFeatureFlag).mockReturnValue(true);
  });

  it("does not render when onboarding-tour feature flag is disabled", () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);

    const { container } = render(<OnboardingTour />);
    expect(container.firstChild).toBeNull();
  });

  it("renders investor tour steps by default and allows persona switching", async () => {
    render(<OnboardingTour />);

    // Verify investor title is shown after delay
    expect(await screen.findByText("Find the right opportunity", {}, { timeout: 2000 })).toBeInTheDocument();

    // Switch persona to SME
    const smeTab = screen.getByRole("button", { name: "SME" });
    fireEvent.click(smeTab);

    // Verify SME title is shown
    expect(await screen.findByText("Mint an invoice")).toBeInTheDocument();
    expect(useSettingsStore.getState().tour.persona).toBe("sme");
  });

  it("navigates through steps using Next and Back buttons", async () => {
    render(<OnboardingTour />);

    expect(await screen.findByText("Find the right opportunity", {}, { timeout: 2000 })).toBeInTheDocument();

    // Click Next
    const nextBtn = screen.getByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);

    expect(await screen.findByText("Review invoice details")).toBeInTheDocument();
    expect(useSettingsStore.getState().tour.stepIndex).toBe(1);

    // Click Back
    const backBtn = screen.getByRole("button", { name: "Back" });
    fireEvent.click(backBtn);

    expect(await screen.findByText("Find the right opportunity")).toBeInTheDocument();
    expect(useSettingsStore.getState().tour.stepIndex).toBe(0);
  });

  it("completes tour when skip tour is clicked", async () => {
    render(<OnboardingTour />);

    const skipBtn = await screen.findByRole("button", { name: "Skip tour" }, { timeout: 2000 });
    fireEvent.click(skipBtn);

    expect(useSettingsStore.getState().tour.completed).toBe(true);
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBe("true");
  });

  it("investor tour has 5 steps including the analytics step at index 4", async () => {
    // Mount the analytics-header anchor so the optional-skip effect does not
    // auto-complete the tour before we can assert on step 5's content.
    const anchor = document.createElement("div");
    anchor.setAttribute("data-tour", "analytics-header");
    document.body.appendChild(anchor);

    render(<OnboardingTour />);

    // Step 1 visible after mount delay
    expect(await screen.findByText("Find the right opportunity", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();

    // Advance 0 → 1 → 2 → 3
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }

    // Step 4: Track your portfolio
    expect(await screen.findByText("Track your portfolio")).toBeInTheDocument();
    expect(screen.getByText("Step 4 of 5")).toBeInTheDocument();

    // Advance to step 5: analytics
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Explore portfolio analytics")).toBeInTheDocument();
    expect(screen.getByText("Step 5 of 5")).toBeInTheDocument();

    // Last step should show "Finish" not "Next"
    expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument();

    document.body.removeChild(anchor);
  });

  it("SME tour configuration is unchanged (3 steps, no analytics step)", async () => {
    useSettingsStore.setState({ tour: { ...DEFAULT_TOUR_SETTINGS, persona: "sme" } });
    render(<OnboardingTour />);

    expect(await screen.findByText("Mint an invoice", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });
});
