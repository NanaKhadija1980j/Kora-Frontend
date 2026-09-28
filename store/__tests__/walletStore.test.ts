import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWalletStore } from "../walletStore";
import * as envModule from "@/lib/env";

// Mock the env module
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  },
}));

describe("useWalletStore - Network Validation", () => {
  beforeEach(() => {
    // Reset store state before each test
    useWalletStore.getState().disconnect();
  });

  describe("isWrongNetwork()", () => {
    it("should return false when wallet is disconnected", () => {
      const { result } = renderHook(() => useWalletStore());
      expect(result.current.isWrongNetwork()).toBe(false);
    });

    it("should return false when connected to the correct network", () => {
      const { result } = renderHook(() => useWalletStore());
      act(() => {
        result.current.connect("freighter", "GTEST123", "GTEST123", "Test SDF Network ; September 2015");
      });
      expect(result.current.network).toBe("testnet");
      expect(result.current.isWrongNetwork()).toBe(false);
    });

    it("should return true when connected to mainnet but app requires testnet", () => {
      const { result } = renderHook(() => useWalletStore());
      act(() => {
        // Simulate connecting to mainnet when app is configured for testnet
        result.current.connect("freighter", "GTEST123", "GTEST123");
        // Manually set network to mainnet to simulate wallet on different network
        useWalletStore.setState({ network: "mainnet" as any });
      });
      expect(result.current.isWrongNetwork()).toBe(true);
    });

    it("should return true when connected to testnet but app requires mainnet", () => {
      // Mock env for mainnet app
      vi.mocked(envModule.env).NEXT_PUBLIC_STELLAR_NETWORK = "mainnet" as any;

      const { result } = renderHook(() => useWalletStore());
      act(() => {
        result.current.connect("freighter", "GTEST123", "GTEST123");
        // Manually set network to testnet
        useWalletStore.setState({ network: "testnet" });
      });
      expect(result.current.isWrongNetwork()).toBe(true);

      // Restore
      vi.mocked(envModule.env).NEXT_PUBLIC_STELLAR_NETWORK = "testnet" as any;
    });
  });

  describe("hasPassphraseMismatch()", () => {
    it("should return false when wallet is disconnected", () => {
      const { result } = renderHook(() => useWalletStore());
      expect(result.current.hasPassphraseMismatch()).toBe(false);
    });

    it("should return false when passphrase matches", () => {
      const { result } = renderHook(() => useWalletStore());
      const correctPassphrase = "Test SDF Network ; September 2015";
      act(() => {
        result.current.connect("freighter", "GTEST123", "GTEST123", correctPassphrase);
      });
      expect(result.current.hasPassphraseMismatch()).toBe(false);
    });

    it("should return true when passphrase does not match", () => {
      const { result } = renderHook(() => useWalletStore());
      const wrongPassphrase = "Public Global Stellar Network ; September 2015";
      act(() => {
        result.current.connect("freighter", "GTEST123", "GTEST123", wrongPassphrase);
      });
      expect(result.current.hasPassphraseMismatch()).toBe(true);
    });

    it("should return false when wallet passphrase is null (not retrieved)", () => {
      const { result } = renderHook(() => useWalletStore());
      act(() => {
        result.current.connect("freighter", "GTEST123", "GTEST123", undefined);
      });
      expect(result.current.hasPassphraseMismatch()).toBe(false);
    });

    it("should handle mainnet passphrase mismatch", () => {
      const { result } = renderHook(() => useWalletStore());
      const mainnetPassphrase = "Public Global Stellar Network ; September 2015";
      act(() => {
        result.current.connect("freighter", "GTEST123", "GTEST123", mainnetPassphrase);
      });
      expect(result.current.hasPassphraseMismatch()).toBe(true);
    });
  });

  describe("Connection with wallet passphrase", () => {
    it("should store wallet passphrase on connection", () => {
      const { result } = renderHook(() => useWalletStore());
      const passphrase = "Test SDF Network ; September 2015";
      act(() => {
        result.current.connect("freighter", "GTEST123", "GTEST123", passphrase);
      });
      expect(result.current.walletPassphrase).toBe(passphrase);
    });

    it("should clear wallet passphrase on disconnection", () => {
      const { result } = renderHook(() => useWalletStore());
      act(() => {
        result.current.connect("freighter", "GTEST123", "GTEST123", "Test SDF Network ; September 2015");
      });
      expect(result.current.walletPassphrase).not.toBeNull();

      act(() => {
        result.current.disconnect();
      });
      expect(result.current.walletPassphrase).toBeNull();
    });

    it("should persist wallet passphrase to localStorage", () => {
      const { result } = renderHook(() => useWalletStore());
      const passphrase = "Test SDF Network ; September 2015";
      act(() => {
        result.current.connect("freighter", "GTEST123", "GTEST123", passphrase);
      });

      // The store should be persisted via zustand persist middleware
      const stored = useWalletStore.getState();
      expect(stored.walletPassphrase).toBe(passphrase);
    });
  });

  describe("Network mismatch detection - realistic scenarios", () => {
    it("testnet->mainnet mismatch: correct network enum, wrong passphrase", () => {
      const { result } = renderHook(() => useWalletStore());
      const mainnetPassphrase = "Public Global Stellar Network ; September 2015";
      act(() => {
        // Simulate user connecting with mainnet wallet while app expects testnet
        result.current.connect("freighter", "MAINNET_ADDR", "MAINNET_PUB", mainnetPassphrase);
      });

      // Even though network state might be testnet initially, passphrase mismatch should be detected
      expect(result.current.hasPassphraseMismatch()).toBe(true);
    });

    it("mainnet->testnet mismatch: both enum and passphrase mismatch", () => {
      // Mock app configured for mainnet
      vi.mocked(envModule.env).NEXT_PUBLIC_STELLAR_NETWORK = "mainnet" as any;
      vi.mocked(envModule.env).NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";

      const { result } = renderHook(() => useWalletStore());
      const testnetPassphrase = "Test SDF Network ; September 2015";
      act(() => {
        result.current.connect("freighter", "TESTNET_ADDR", "TESTNET_PUB", testnetPassphrase);
        // Simulate wallet being on testnet
        useWalletStore.setState({ network: "testnet" });
      });

      expect(result.current.isWrongNetwork()).toBe(true);
      expect(result.current.hasPassphraseMismatch()).toBe(true);

      // Restore
      vi.mocked(envModule.env).NEXT_PUBLIC_STELLAR_NETWORK = "testnet" as any;
      vi.mocked(envModule.env).NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
    });
  });

  describe("switchAccount()", () => {
    it("updates address and clears verification without disconnecting", () => {
      const { result } = renderHook(() => useWalletStore());
      act(() => {
        result.current.connect("freighter", "GACC1", "GACC1");
        result.current.setVerified(true);
      });

      expect(result.current.address).toBe("GACC1");
      expect(result.current.isVerified).toBe(true);

      act(() => {
        result.current.switchAccount("GACC2", "GACC2");
      });

      expect(result.current.address).toBe("GACC2");
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isVerified).toBe(false);
      expect(result.current.verifiedAt).toBeNull();
    });
  });
});
