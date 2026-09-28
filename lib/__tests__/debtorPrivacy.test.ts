/**
 * Unit tests for `lib/debtorPrivacy` — Issue #695.
 *
 * Colocated with the module under `lib/__tests__/` per CONTRIBUTING.md. These
 * exercise the masking helpers directly against plain invoice shapes rather
 * than through a rendered card, so every privacy branch — including the
 * degenerate ones a card never produces (absent metadata, unknown category or
 * jurisdiction codes) — is pinned without a DOM.
 */

import { describe, it, expect } from "vitest";
import {
  CATEGORY_DESCRIPTORS,
  JURISDICTION_NAMES,
  getDebtorAriaLabel,
  getEffectiveDebtorPrivacy,
  getMaskedDebtorAddress,
  getMaskedDebtorName,
  isDebtorAnonymized,
  isDebtorFull,
  isDebtorPartial,
} from "@/lib/debtorPrivacy";
import type { Invoice, DebtorPrivacyLevel } from "@/types/invoice";

/**
 * A minimal invoice slice. The helpers take `Partial<Invoice>` and only ever
 * read `debtorPrivacy` and `metadata`, so building the full 30-field invoice
 * here would hide which fields actually drive the branch under test.
 */
function invoice(
  debtorPrivacy: DebtorPrivacyLevel | undefined,
  metadata?: Partial<Invoice["metadata"]>
): Partial<Invoice> {
  return {
    ...(debtorPrivacy ? { debtorPrivacy } : {}),
    ...(metadata ? { metadata: metadata as Invoice["metadata"] } : {}),
  } as Partial<Invoice>;
}

const KE_TECH = {
  debtorName: "Confidential Enterprise Ltd",
  debtorAddress: "100 Confidential Road, Nairobi",
  jurisdiction: "KE" as const,
  category: "technology" as const,
};

describe("getEffectiveDebtorPrivacy", () => {
  it("returns the invoice's declared level when unfunded", () => {
    expect(getEffectiveDebtorPrivacy(invoice("partial", KE_TECH))).toBe("partial");
    expect(getEffectiveDebtorPrivacy(invoice("full", KE_TECH))).toBe("full");
    expect(getEffectiveDebtorPrivacy(invoice("anonymized", KE_TECH))).toBe(
      "anonymized"
    );
  });

  it("falls back to anonymized when no level is declared", () => {
    // Fail closed: an invoice minted before `debtorPrivacy` existed must not
    // default into disclosure.
    expect(getEffectiveDebtorPrivacy(invoice(undefined, KE_TECH))).toBe(
      "anonymized"
    );
    expect(getEffectiveDebtorPrivacy({})).toBe("anonymized");
  });

  it("elevates every level to full once the invoice is funded", () => {
    for (const level of ["anonymized", "partial", "full"] as const) {
      expect(getEffectiveDebtorPrivacy(invoice(level, KE_TECH), true)).toBe("full");
    }
  });

  it("elevates an invoice with no declared level when funded", () => {
    expect(getEffectiveDebtorPrivacy({}, true)).toBe("full");
  });
});

describe("getMaskedDebtorName", () => {
  it("returns a category and jurisdiction moniker when anonymized", () => {
    expect(getMaskedDebtorName(invoice("anonymized", KE_TECH))).toBe(
      "Technology Company (Kenya)"
    );
  });

  it("never leaks the raw debtor name when anonymized", () => {
    expect(getMaskedDebtorName(invoice("anonymized", KE_TECH))).not.toContain(
      "Confidential Enterprise Ltd"
    );
  });

  it("returns the debtor name under partial disclosure", () => {
    expect(
      getMaskedDebtorName(invoice("partial", { ...KE_TECH, debtorName: "Acme SA" }))
    ).toBe("Acme SA");
  });

  it("returns the debtor name under full disclosure", () => {
    expect(
      getMaskedDebtorName(invoice("full", { ...KE_TECH, debtorName: "Acme SA" }))
    ).toBe("Acme SA");
  });

  it("reveals the name once funded, even from an anonymized invoice", () => {
    expect(getMaskedDebtorName(invoice("anonymized", KE_TECH), true)).toBe(
      "Confidential Enterprise Ltd"
    );
  });

  it("masks generically when metadata is missing entirely", () => {
    // No metadata means no category or jurisdiction to describe — the helper
    // must still return something safe rather than throw.
    expect(getMaskedDebtorName(invoice("full", undefined))).toBe(
      "Commercial Enterprise (International)"
    );
  });

  it("masks generically when funded but metadata is missing", () => {
    expect(getMaskedDebtorName({}, true)).toBe(
      "Commercial Enterprise (International)"
    );
  });

  it("falls back to the OTHER descriptors for absent category and jurisdiction", () => {
    expect(getMaskedDebtorName(invoice("anonymized", { debtorName: "X" }))).toBe(
      "Commercial Enterprise (International)"
    );
  });

  it("passes an unrecognised jurisdiction code through verbatim", () => {
    const masked = getMaskedDebtorName(
      invoice("anonymized", { ...KE_TECH, jurisdiction: "ZZ" as never })
    );
    expect(masked).toBe("Technology Company (ZZ)");
  });

  it("falls back to the generic descriptor for an unrecognised category", () => {
    const masked = getMaskedDebtorName(
      invoice("anonymized", { ...KE_TECH, category: "space-mining" as never })
    );
    expect(masked).toBe("Commercial Enterprise (Kenya)");
  });

  it('returns "Debtor" when disclosure is allowed but the name is blank', () => {
    expect(
      getMaskedDebtorName(invoice("full", { ...KE_TECH, debtorName: "" }))
    ).toBe("Debtor");
  });

  it("describes every category and jurisdiction it declares support for", () => {
    // Guards the lookup tables against a type being widened without the
    // descriptor maps being extended alongside it.
    for (const category of Object.keys(CATEGORY_DESCRIPTORS) as Array<
      keyof typeof CATEGORY_DESCRIPTORS
    >) {
      for (const jurisdiction of Object.keys(JURISDICTION_NAMES) as Array<
        keyof typeof JURISDICTION_NAMES
      >) {
        expect(
          getMaskedDebtorName(invoice("anonymized", { category, jurisdiction }))
        ).toBe(
          `${CATEGORY_DESCRIPTORS[category]} (${JURISDICTION_NAMES[jurisdiction]})`
        );
      }
    }
  });
});

describe("getMaskedDebtorAddress", () => {
  it("returns the street address under full disclosure", () => {
    expect(getMaskedDebtorAddress(invoice("full", KE_TECH))).toBe(
      "100 Confidential Road, Nairobi"
    );
  });

  it("returns country-only under partial disclosure", () => {
    expect(getMaskedDebtorAddress(invoice("partial", KE_TECH))).toBe(
      "Address hidden · Kenya"
    );
  });

  it("never leaks the street under partial disclosure", () => {
    expect(getMaskedDebtorAddress(invoice("partial", KE_TECH))).not.toContain(
      "Confidential Road"
    );
  });

  it("falls back to International when partial has no jurisdiction", () => {
    expect(
      getMaskedDebtorAddress(invoice("partial", { debtorAddress: "somewhere" }))
    ).toBe("Address hidden · International");
  });

  it("passes an unrecognised jurisdiction code through verbatim", () => {
    expect(
      getMaskedDebtorAddress(
        invoice("partial", { ...KE_TECH, jurisdiction: "ZZ" as never })
      )
    ).toBe("Address hidden · ZZ");
  });

  it("returns the anonymized notice when anonymized", () => {
    expect(getMaskedDebtorAddress(invoice("anonymized", KE_TECH))).toBe(
      "Identity anonymized for privacy"
    );
  });

  it("reveals the street once funded", () => {
    expect(getMaskedDebtorAddress(invoice("anonymized", KE_TECH), true)).toBe(
      "100 Confidential Road, Nairobi"
    );
  });

  it("returns an empty string when metadata is missing", () => {
    expect(getMaskedDebtorAddress(invoice("full", undefined))).toBe("");
    expect(getMaskedDebtorAddress({}, true)).toBe("");
  });

  it("returns an empty string when full disclosure has no address on file", () => {
    expect(
      getMaskedDebtorAddress(invoice("full", { ...KE_TECH, debtorAddress: "" }))
    ).toBe("");
  });
});

describe("getDebtorAriaLabel", () => {
  it("marks an anonymized debtor as anonymized without leaking the name", () => {
    const label = getDebtorAriaLabel(invoice("anonymized", KE_TECH));
    expect(label).toBe("Debtor: Technology Company (Kenya) (Anonymized for privacy)");
    expect(label).not.toContain("Confidential Enterprise Ltd");
  });

  it("marks a partial debtor as partial disclosure", () => {
    expect(
      getDebtorAriaLabel(invoice("partial", { ...KE_TECH, debtorName: "Acme SA" }))
    ).toBe("Debtor: Acme SA (Partial disclosure)");
  });

  it("marks a full debtor as full disclosure", () => {
    expect(
      getDebtorAriaLabel(invoice("full", { ...KE_TECH, debtorName: "Acme SA" }))
    ).toBe("Debtor: Acme SA (Full disclosure)");
  });

  it("reports full disclosure once funded", () => {
    expect(getDebtorAriaLabel(invoice("anonymized", KE_TECH), true)).toBe(
      "Debtor: Confidential Enterprise Ltd (Full disclosure)"
    );
  });
});

describe("privacy level predicates", () => {
  it("agrees with the effective level for each declared level", () => {
    const cases: Array<[DebtorPrivacyLevel, [boolean, boolean, boolean]]> = [
      ["anonymized", [true, false, false]],
      ["partial", [false, true, false]],
      ["full", [false, false, true]],
    ];

    for (const [level, [anon, partial, full]] of cases) {
      const inv = invoice(level, KE_TECH);
      expect(isDebtorAnonymized(inv)).toBe(anon);
      expect(isDebtorPartial(inv)).toBe(partial);
      expect(isDebtorFull(inv)).toBe(full);
    }
  });

  it("reports exactly one level as true at a time", () => {
    for (const level of ["anonymized", "partial", "full"] as const) {
      const inv = invoice(level, KE_TECH);
      const flags = [isDebtorAnonymized(inv), isDebtorPartial(inv), isDebtorFull(inv)];
      expect(flags.filter(Boolean)).toHaveLength(1);
    }
  });

  it("reports full for any level once funded", () => {
    for (const level of ["anonymized", "partial", "full"] as const) {
      const inv = invoice(level, KE_TECH);
      expect(isDebtorFull(inv, true)).toBe(true);
      expect(isDebtorAnonymized(inv, true)).toBe(false);
      expect(isDebtorPartial(inv, true)).toBe(false);
    }
  });
});
