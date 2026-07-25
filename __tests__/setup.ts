/**
 * Test setup file with common utilities, mocks, and mock providers
 */

import { vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

/**
 * Create a new QueryClient for each test to avoid cross-test cache pollution
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Global router mock
export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
};

export const mockParams = vi.fn(() => ({}));

/**
 * Mock next/navigation for client components
 */
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => "/"),
  useParams: () => mockParams(),
}));

/**
 * Mock framer-motion to avoid animation complications in tests
 */
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { div: Div } = require("react");
      return Div({ ...props }, children);
    },
  },
  AnimatePresence: ({ children }: any) => children,
}));

/**
 * Mock sonner toast notifications
 */
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    promise: vi.fn(),
  },
}));
