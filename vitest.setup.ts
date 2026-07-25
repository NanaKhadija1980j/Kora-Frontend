// Set mock environment variables before any other imports to pass schema validation
process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
process.env.NEXT_PUBLIC_STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";
process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = "https://horizon-testnet.stellar.org";
process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
process.env.NEXT_PUBLIC_IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";
process.env.PINATA_JWT = "mock_jwt";

import React from "react";
import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Mock missing jspdf virtual module for export utilities
vi.mock("jspdf", () => ({
  default: class {
    internal = {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    };
    addImage() {}
    addPage() {}
    save() {}
  },
}));

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

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: any) => {
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

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (!values) return key;
    return key.replace(/\{(.*?)\}/g, (_, group) => String(values[group] ?? `{${group}}`));
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
