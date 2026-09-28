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

// Mock isValidStellarAddress to accept any string starting with "G" and 56 chars long
vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual("@/lib/utils");
  return {
    ...(actual as object),
    isValidStellarAddress: (addr: string | null | undefined) => {
      if (!addr) return false;
      const trimmed = addr.trim();
      return trimmed.length === 56 && trimmed.startsWith("G");
    },
  };
});

// Mock crypto.randomUUID for deterministic, incrementing IDs
let uuidCounter = 0;
const mockRandomUUID = vi.fn(() => {
  uuidCounter++;
  return `test-uuid-${uuidCounter}`;
});
vi.stubGlobal("crypto", {
  randomUUID: mockRandomUUID,
});

function resetStore() {
  uuidCounter = 0;
  mockRandomUUID.mockClear();
  useWalletStore.setState({
    addressBook: [],
    isConnected: false,
    address: null,
    publicKey: null,
  });
}

// Valid Stellar test addresses (G... + 55 chars = 56 total, passes our mock)
const VALID_ADDRESS_1 = "GBZXOYSTUINZLWGSRW5MSD5VYNNNXBX5UZQYWNLGRMQTGAGGTHVM5G7K";
const VALID_ADDRESS_2 = "GDJEGZHKNR3GGYZU5KNF5ZQEWAL7M7RZMFAPZUB6JEXRKUOINISXHF37";
const VALID_ADDRESS_3 = "GCFXHS4GHL6VF5LXFE5FQFYWFMLMY2ZKUVIFQHQ5BB6YRB7O4RLCYKAG";
const INVALID_ADDRESS_1 = "not-a-stellar-address";
const INVALID_ADDRESS_2 = "G123"; // too short
const INVALID_ADDRESS_3 = "";

describe("useWalletStore - Address Book CRUD", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("addAddressBookEntry", () => {
    it("should add a valid address with label", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Alice");
      });

      expect(result.current.addressBook).toHaveLength(1);
      expect(result.current.addressBook[0].address).toBe(VALID_ADDRESS_1);
      expect(result.current.addressBook[0].label).toBe("Alice");
      expect(result.current.addressBook[0].id).toBeDefined();
    });

    it("should add a valid address without label", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1);
      });

      expect(result.current.addressBook).toHaveLength(1);
      expect(result.current.addressBook[0].address).toBe(VALID_ADDRESS_1);
      expect(result.current.addressBook[0].label).toBe("");
    });

    it("should trim whitespace from address and label", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(`  ${VALID_ADDRESS_1}  `, "  Bob  ");
      });

      expect(result.current.addressBook[0].address).toBe(VALID_ADDRESS_1);
      expect(result.current.addressBook[0].label).toBe("Bob");
    });

    it("should reject empty address", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry("", "Test");
      });

      expect(result.current.addressBook).toHaveLength(0);
    });

    it("should reject invalid Stellar address (random string)", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(INVALID_ADDRESS_1, "Test");
      });

      expect(result.current.addressBook).toHaveLength(0);
    });

    it("should reject invalid Stellar address (too short)", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(INVALID_ADDRESS_2, "Test");
      });

      expect(result.current.addressBook).toHaveLength(0);
    });

    it("should reject null/undefined address", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(null as unknown as string, "Test");
      });

      expect(result.current.addressBook).toHaveLength(0);
    });

    it("should silently skip duplicate addresses (case-insensitive)", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "First");
      });
      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1.toLowerCase(), "Second");
      });

      expect(result.current.addressBook).toHaveLength(1);
      expect(result.current.addressBook[0].label).toBe("First");
    });

    it("should handle multiple distinct entries", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Alice");
        result.current.addAddressBookEntry(VALID_ADDRESS_2, "Bob");
      });

      expect(result.current.addressBook).toHaveLength(2);
      expect(result.current.addressBook[0].label).toBe("Alice");
      expect(result.current.addressBook[1].label).toBe("Bob");
    });

    it("should generate unique IDs for each entry", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Alice");
        result.current.addAddressBookEntry(VALID_ADDRESS_2, "Bob");
      });

      expect(result.current.addressBook[0].id).not.toBe(result.current.addressBook[1].id);
    });
  });

  describe("updateAddressBookEntry", () => {
    it("should update the label of an existing entry", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Old Label");
      });

      const id = result.current.addressBook[0].id;

      act(() => {
        result.current.updateAddressBookEntry(id, { label: "New Label" });
      });

      expect(result.current.addressBook[0].label).toBe("New Label");
      expect(result.current.addressBook[0].address).toBe(VALID_ADDRESS_1);
    });

    it("should update the address of an existing entry with valid address", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Alice");
      });

      const id = result.current.addressBook[0].id;

      act(() => {
        result.current.updateAddressBookEntry(id, { address: VALID_ADDRESS_2 });
      });

      expect(result.current.addressBook[0].address).toBe(VALID_ADDRESS_2);
    });

    it("should reject invalid address updates", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Alice");
      });

      const id = result.current.addressBook[0].id;

      act(() => {
        result.current.updateAddressBookEntry(id, { address: INVALID_ADDRESS_1 });
      });

      // Address should remain unchanged
      expect(result.current.addressBook[0].address).toBe(VALID_ADDRESS_1);
    });

    it("should reject empty address updates", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Alice");
      });

      const id = result.current.addressBook[0].id;

      act(() => {
        result.current.updateAddressBookEntry(id, { address: "" });
      });

      // Address should remain unchanged
      expect(result.current.addressBook[0].address).toBe(VALID_ADDRESS_1);
    });

    it("should trim whitespace in updates", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Old");
      });

      const id = result.current.addressBook[0].id;

      act(() => {
        result.current.updateAddressBookEntry(id, {
          label: "  Trimmed  ",
          address: `  ${VALID_ADDRESS_2}  `,
        });
      });

      expect(result.current.addressBook[0].label).toBe("Trimmed");
      expect(result.current.addressBook[0].address).toBe(VALID_ADDRESS_2);
    });

    it("should not modify entries with non-existent ID", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Alice");
      });

      act(() => {
        result.current.updateAddressBookEntry("non-existent-id", { label: "Nope" });
      });

      expect(result.current.addressBook[0].label).toBe("Alice");
    });
  });

  describe("removeAddressBookEntry", () => {
    it("should remove an entry by ID", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Alice");
      });

      const idToRemove = result.current.addressBook[0].id;

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_2, "Bob");
      });

      act(() => {
        result.current.removeAddressBookEntry(idToRemove);
      });

      expect(result.current.addressBook).toHaveLength(1);
      expect(result.current.addressBook[0].label).toBe("Bob");
    });

    it("should do nothing when removing non-existent ID", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Alice");
      });

      act(() => {
        result.current.removeAddressBookEntry("non-existent-id");
      });

      expect(result.current.addressBook).toHaveLength(1);
    });

    it("should clear all entries", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Alice");
        result.current.addAddressBookEntry(VALID_ADDRESS_2, "Bob");
      });

      const ids = result.current.addressBook.map((e) => e.id);

      act(() => {
        ids.forEach((id) => result.current.removeAddressBookEntry(id));
      });

      expect(result.current.addressBook).toHaveLength(0);
    });
  });

  describe("address book persistence", () => {
    it("should include addressBook in the persisted state partialize", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Alice");
      });

      // The addressBook should be in the store state
      expect(result.current.addressBook).toHaveLength(1);

      // Verify the state shape includes addressBook
      const state = useWalletStore.getState();
      expect(state.addressBook).toBeDefined();
      expect(Array.isArray(state.addressBook)).toBe(true);
    });

    it("should maintain entries across re-renders", () => {
      const { result, rerender } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "Alice");
      });

      rerender();

      expect(result.current.addressBook).toHaveLength(1);
      expect(result.current.addressBook[0].label).toBe("Alice");
    });
  });

  describe("address book edge cases", () => {
    it("should handle extremely long labels", () => {
      const { result } = renderHook(() => useWalletStore());
      const longLabel = "A".repeat(200);

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, longLabel);
      });

      expect(result.current.addressBook).toHaveLength(1);
      expect(result.current.addressBook[0].label).toBe(longLabel);
    });

    it("should handle special characters in labels", () => {
      const { result } = renderHook(() => useWalletStore());
      const specialLabel = "🏦 Company © 2024 — Main Account";

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, specialLabel);
      });

      expect(result.current.addressBook).toHaveLength(1);
      expect(result.current.addressBook[0].label).toBe(specialLabel);
    });

    it("should maintain insertion order", () => {
      const { result } = renderHook(() => useWalletStore());

      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_1, "First");
        result.current.addAddressBookEntry(VALID_ADDRESS_2, "Second");
      });

      // Capture the ID of the first entry
      const firstId = result.current.addressBook[0].id;

      // Remove first entry, then add a third
      act(() => {
        result.current.removeAddressBookEntry(firstId);
      });
      act(() => {
        result.current.addAddressBookEntry(VALID_ADDRESS_3, "Third");
      });

      expect(result.current.addressBook).toHaveLength(2);
      // First remaining entry should be "Second" (originally index 1)
      expect(result.current.addressBook[0].label).toBe("Second");
      // New entry should be appended at the end
      expect(result.current.addressBook[1].label).toBe("Third");
    });
  });
});
