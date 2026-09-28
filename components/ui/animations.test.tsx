/**
 * Tests for prefers-reduced-motion guards in animation components.
 *
 * We mock framer-motion's useReducedMotion to simulate a user who has
 * enabled the "reduce motion" OS accessibility setting.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ── Mock framer-motion's useReducedMotion ─────────────────────────────────────
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false), // default: motion enabled
  };
});

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/test-path"),
}));

import { useReducedMotion } from "framer-motion";
import { SuccessCheckmark, SpinnerCircle, SpinnerDots, SpinnerPulse } from "./animations";
import { PageTransition } from "@/components/layout/PageTransition";

const mockUseReducedMotion = vi.mocked(useReducedMotion);

describe("animations — prefers-reduced-motion", () => {
  describe("SuccessCheckmark", () => {
    it("renders without errors when motion is enabled", () => {
      mockUseReducedMotion.mockReturnValue(false);
      const { container } = render(<SuccessCheckmark />);
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("renders without errors when reduced motion is preferred", () => {
      mockUseReducedMotion.mockReturnValue(true);
      const { container } = render(<SuccessCheckmark />);
      // SVG must still be present (no broken/empty state)
      expect(container.querySelector("svg")).toBeInTheDocument();
      expect(container.querySelector("circle")).toBeInTheDocument();
      expect(container.querySelector("path")).toBeInTheDocument();
    });
  });

  describe("SpinnerCircle", () => {
    it("renders without errors when motion is enabled", () => {
      mockUseReducedMotion.mockReturnValue(false);
      const { container } = render(<SpinnerCircle />);
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("still renders svg when reduced motion is preferred", () => {
      mockUseReducedMotion.mockReturnValue(true);
      const { container } = render(<SpinnerCircle />);
      expect(container.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("SpinnerDots", () => {
    it("renders 3 dots when motion is enabled", () => {
      mockUseReducedMotion.mockReturnValue(false);
      const { container } = render(<SpinnerDots />);
      expect(container.querySelectorAll("span")).toHaveLength(3);
    });

    it("renders 3 dots when reduced motion is preferred", () => {
      mockUseReducedMotion.mockReturnValue(true);
      const { container } = render(<SpinnerDots />);
      expect(container.querySelectorAll("span")).toHaveLength(3);
    });
  });

  describe("SpinnerPulse", () => {
    it("renders when motion is enabled", () => {
      mockUseReducedMotion.mockReturnValue(false);
      const { container } = render(<SpinnerPulse />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders without motion elements broken when reduced motion is preferred", () => {
      mockUseReducedMotion.mockReturnValue(true);
      const { container } = render(<SpinnerPulse />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe("PageTransition", () => {
    it("renders children with animated wrapper when motion is enabled", () => {
      mockUseReducedMotion.mockReturnValue(false);
      render(
        <PageTransition>
          <div data-testid="page-child">Content</div>
        </PageTransition>
      );
      expect(screen.getByTestId("page-child")).toBeInTheDocument();
    });

    it("renders children without motion animation when reduced motion is preferred", () => {
      mockUseReducedMotion.mockReturnValue(true);
      render(
        <PageTransition>
          <div data-testid="page-child">Content</div>
        </PageTransition>
      );
      expect(screen.getByTestId("page-child")).toBeInTheDocument();
    });
  });
});
