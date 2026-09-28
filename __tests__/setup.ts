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


/**
 * Mock framer-motion to avoid animation complications in tests
 */
export function setupFramerMotionMocks() {
  vi.mock("framer-motion", () => ({
    motion: {
      div: "div",
      button: "button",
      span: "span",
      p: "p",
      h1: "h1",
      h2: "h2",
      h3: "h3",
    },
    AnimatePresence: ({ children }: any) => children,
  }));
}

/**
 * Mock sonner toast notifications
 */
export function setupSonnerMocks() {
  vi.mock("sonner", () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      loading: vi.fn(),
      promise: vi.fn(),
    },
  }));
}
