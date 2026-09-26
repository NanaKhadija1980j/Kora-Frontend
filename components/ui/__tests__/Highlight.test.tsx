/**
 * Component tests for Highlight query matching (#823).
 *
 * Covers empty/whitespace queries, regex-escaping of special characters,
 * and <mark> wrapping of every case-insensitive match.
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Highlight } from "../Highlight";

function renderHighlight(text: string, query: string, className?: string) {
  const { container } = render(<Highlight text={text} query={query} className={className} />);
  const root = container.firstElementChild as HTMLElement;
  const marks = Array.from(root.querySelectorAll("mark")).map((m) => m.textContent);
  return { root, marks };
}

describe("Highlight", () => {
  describe("empty query", () => {
    it.each(["", "   "])("renders plain text without marks for query %j", (query) => {
      const { root, marks } = renderHighlight("Invoice INV-001", query);

      expect(root.tagName).toBe("SPAN");
      expect(root).toHaveTextContent("Invoice INV-001");
      expect(marks).toEqual([]);
    });

    it("applies className on the empty-query path", () => {
      const { root } = renderHighlight("Invoice", "", "custom");
      expect(root).toHaveClass("custom");
    });
  });

  describe("mark wraps", () => {
    it("wraps a single match and keeps surrounding text", () => {
      const { root, marks } = renderHighlight("Acme Logistics Ltd", "Logistics");

      expect(marks).toEqual(["Logistics"]);
      expect(root).toHaveTextContent("Acme Logistics Ltd");
    });

    it("matches case-insensitively and preserves original casing", () => {
      const { marks } = renderHighlight("Kora invoice", "KORA");
      expect(marks).toEqual(["Kora"]);
    });

    it("wraps every occurrence", () => {
      const { marks } = renderHighlight("pay, repay, prepay", "pay");
      expect(marks).toEqual(["pay", "pay", "pay"]);
    });

    it("wraps adjacent occurrences separately", () => {
      const { root, marks } = renderHighlight("aaa", "a");

      expect(marks).toEqual(["a", "a", "a"]);
      expect(root).toHaveTextContent("aaa");
    });

    it("renders no marks when nothing matches", () => {
      const { root, marks } = renderHighlight("Acme", "zzz");

      expect(marks).toEqual([]);
      expect(root).toHaveTextContent("Acme");
    });

    it("applies className to the wrapper when matching", () => {
      const { root } = renderHighlight("Acme", "ac", "custom");
      expect(root).toHaveClass("custom");
    });
  });

  describe("regex-escape", () => {
    it.each([
      ["$1,000.50", "$1,000.50"],
      ["INV (draft)", "(draft)"],
      ["a+b=c", "a+b"],
      ["path\\to\\file", "\\to"],
      ["[tag] item", "[tag]"],
      ["what? really*", "?"],
      ["x|y", "|"],
      ["^start", "^"],
      ["{a}", "{a}"],
    ])("treats special characters literally in %j for query %j", (text, query) => {
      const { root, marks } = renderHighlight(text, query);

      expect(marks).toEqual([query]);
      expect(root).toHaveTextContent(text);
    });

    it("does not treat '.' as a wildcard", () => {
      const { marks } = renderHighlight("abc a.c", ".");
      expect(marks).toEqual(["."]);
    });

    it("does not throw on an unbalanced pattern", () => {
      expect(() => renderHighlight("f(x", "(")).not.toThrow();
    });
  });
});
