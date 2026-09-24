/**
 * Vitest setup file for integration tests
 * Configures jsdom environment, mocks, and global test utilities
 */

import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock window.matchMedia for responsive components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Polyfill localStorage for jsdom + Node 20 native clash.
// jsdom exposes localStorage on `window` but bare `localStorage` (as used
// by `__tests__/install-prompt*.ts*`) resolves to `global`. Node 20+ also
// ships a native `globalThis.localStorage` that requires --localstorage-file
// and is `undefined` without it. We ensure a working implementation exists.
(function setupLocalStorage() {
  const createMockStorage = () => {
    let store: Record<string, string> = {};
    return {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = String(value);
      },
      removeItem(key: string) {
        delete store[key];
      },
      clear() {
        store = {};
      },
      get length() {
        return Object.keys(store).length;
      },
      key(n: number) {
        const keys = Object.keys(store);
        return keys[n] ?? null;
      },
    };
  };

  // Ensure window.localStorage exists
  if (typeof window !== "undefined") {
    let needMock = false;
    try {
      needMock = !window.localStorage || typeof window.localStorage.getItem !== "function";
    } catch {
      needMock = true;
    }
    if (needMock) {
      const mock = createMockStorage();
      Object.defineProperty(window, "localStorage", {
        value: mock,
        writable: true,
        configurable: true,
      });
    }
    // Alias to global scopes so bare `localStorage` works
    const target = (window as unknown as { localStorage: Storage }).localStorage;
    try {
      Object.defineProperty(globalThis, "localStorage", {
        value: target,
        writable: true,
        configurable: true,
      });
    } catch {}
    try {
      // @ts-expect-error — Node global
      if (typeof global !== "undefined") {
        Object.defineProperty(global, "localStorage", {
          value: target,
          writable: true,
          configurable: true,
        });
      }
    } catch {}
  } else if (typeof globalThis !== "undefined" && !(globalThis as unknown as { localStorage: unknown }).localStorage) {
    const mock = createMockStorage();
    Object.defineProperty(globalThis, "localStorage", {
      value: mock,
      writable: true,
      configurable: true,
    });
  }
})();

import React from "react";

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return React.createElement("img", props);
  },
}));

// Mock sonner toast by default
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    promise: vi.fn(),
  },
}));

import * as matchers from "@testing-library/jest-dom/matchers";
expect.extend(matchers);
