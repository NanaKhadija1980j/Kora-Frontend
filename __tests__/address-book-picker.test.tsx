/**
 * Component tests for AddressBookPicker (Issue #769).
 *
 * The address-book store is already covered; the picker's UX and a11y were not.
 * These exercise the parts a user actually touches: the empty states, the
 * search filter, favourite ordering, group filtering, keyboard navigation, and
 * the listbox roles a screen reader depends on.
 */

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddressBookPicker } from "@/components/wallet/AddressBookPicker";

type Entry = {
  id: string;
  address: string;
  label: string;
  groupIds: string[];
  isFavorite: boolean;
};

const ALICE: Entry = {
  id: "1",
  address: "GALICE000000000000000000000000000000000000000000000000AA",
  label: "Alice",
  groupIds: ["suppliers"],
  isFavorite: false,
};

const BOB: Entry = {
  id: "2",
  address: "GBOB0000000000000000000000000000000000000000000000000BB",
  label: "Bob",
  groupIds: [],
  isFavorite: true,
};

const CAROL: Entry = {
  id: "3",
  address: "GCAROL00000000000000000000000000000000000000000000000CC",
  label: "Carol",
  groupIds: ["suppliers"],
  isFavorite: false,
};

// The store is read through two selectors; this stands in for both.
let mockAddressBook: Entry[] = [];
let mockGroups: Array<{ id: string; name: string }> = [];

vi.mock("@/store", () => ({
  useWalletStore: (selector: (s: unknown) => unknown) =>
    selector({ addressBook: mockAddressBook, addressBookGroups: mockGroups }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const strings: Record<string, string> = {
      pickFromAddressBook: "Pick from address book",
      searchPlaceholder: "Search by address or label…",
      clearSearch: "Clear search",
      savedContacts: "Saved contacts",
      noSaved: "No saved addresses",
      noSearchResults: "No results match your search",
      all: "All",
    };
    return strings[key] ?? key;
  },
}));

function openPicker() {
  fireEvent.click(screen.getByRole("button", { name: "Pick from address book" }));
}

function optionLabels() {
  return within(screen.getByRole("listbox")).getAllByRole("option").map(
    (li) => li.textContent ?? "",
  );
}

describe("AddressBookPicker", () => {
  beforeEach(() => {
    mockAddressBook = [ALICE, BOB, CAROL];
    mockGroups = [];
    vi.clearAllMocks();
  });

  describe("empty states", () => {
    it("renders nothing at all when the address book is empty", () => {
      // Not an empty dropdown — a trigger that opens onto nothing is worse
      // than no trigger.
      mockAddressBook = [];
      const { container } = render(<AddressBookPicker onSelect={vi.fn()} />);

      expect(container).toBeEmptyDOMElement();
    });

    it("shows a no-results message when the search matches nothing", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "zzzz" } });

      expect(screen.getByText("No results match your search")).toBeInTheDocument();
      expect(screen.queryAllByRole("option")).toHaveLength(0);
    });

    it("distinguishes 'nothing saved' from 'nothing matched'", () => {
      // Different problems, different fixes — a user who filtered too hard
      // needs to clear the box, not add a contact.
      mockAddressBook = [ALICE];
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "nope" } });
      expect(screen.getByText("No results match your search")).toBeInTheDocument();
      expect(screen.queryByText("No saved addresses")).not.toBeInTheDocument();
    });
  });

  describe("opening and closing", () => {
    it("is closed initially and reports that to assistive tech", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);

      const trigger = screen.getByRole("button", { name: "Pick from address book" });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("opens on click and flips aria-expanded", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      expect(
        screen.getByRole("button", { name: "Pick from address book" }),
      ).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("closes when Escape is pressed", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("closes on a click outside", () => {
      render(
        <div>
          <AddressBookPicker onSelect={vi.fn()} />
          <button type="button">elsewhere</button>
        </div>,
      );
      openPicker();

      fireEvent.mouseDown(screen.getByRole("button", { name: "elsewhere" }));

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  describe("listing and ordering", () => {
    it("lists every saved contact", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      expect(screen.getAllByRole("option")).toHaveLength(3);
    });

    it("puts favourites first", () => {
      // Bob is the only favourite and is last in the source array.
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      expect(optionLabels()[0]).toContain("Bob");
    });

    it("falls back to a truncated address when a contact has no label", () => {
      mockAddressBook = [{ ...ALICE, label: "" }];
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      // Truncated, not the full 56 characters.
      const option = screen.getByRole("option");
      expect(option.textContent).toContain("…");
      expect(option.textContent).not.toContain(ALICE.address);
    });
  });

  describe("filtering", () => {
    it("filters by label, case-insensitively", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "ALI" } });

      const labels = optionLabels();
      expect(labels).toHaveLength(1);
      expect(labels[0]).toContain("Alice");
    });

    it("filters by address as well as label", () => {
      // Pasting part of an address is how you find a contact you never named.
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "GBOB" } });

      expect(optionLabels()).toHaveLength(1);
      expect(optionLabels()[0]).toContain("Bob");
    });

    it("clears the search from the clear button", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "Alice" } });
      expect(screen.getAllByRole("option")).toHaveLength(1);

      fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

      expect(input).toHaveValue("");
      expect(screen.getAllByRole("option")).toHaveLength(3);
    });

    it("hides the clear button while the search is empty", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    });

    it("filters by group when a group tab is picked", () => {
      mockGroups = [{ id: "suppliers", name: "Suppliers" }];
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      fireEvent.click(screen.getByRole("button", { name: "Suppliers" }));

      // Alice and Carol are in the group; Bob is not.
      expect(optionLabels()).toHaveLength(2);
      expect(optionLabels().join(" ")).not.toContain("Bob");
    });

    it("honours an initial group filter from props", () => {
      mockGroups = [{ id: "suppliers", name: "Suppliers" }];
      render(<AddressBookPicker onSelect={vi.fn()} filterGroupId="suppliers" />);
      openPicker();

      expect(optionLabels()).toHaveLength(2);
    });
  });

  describe("selection", () => {
    it("calls onSelect with the clicked entry and closes", () => {
      const onSelect = vi.fn();
      render(<AddressBookPicker onSelect={onSelect} />);
      openPicker();

      fireEvent.click(screen.getByText("Alice"));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ label: "Alice" }));
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("resets the search after a selection", () => {
      // Reopening onto the previous query would look like a broken address book.
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Alice" } });
      fireEvent.click(screen.getByText("Alice"));
      openPicker();

      expect(screen.getByRole("textbox")).toHaveValue("");
      expect(screen.getAllByRole("option")).toHaveLength(3);
    });
  });

  describe("keyboard navigation", () => {
    it("moves the highlight down with ArrowDown", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      const input = screen.getByRole("textbox");
      fireEvent.keyDown(input, { key: "ArrowDown" });

      const options = screen.getAllByRole("option");
      expect(options[0]).toHaveAttribute("aria-selected", "true");
    });

    it("wraps from the last item back to the first", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      const input = screen.getByRole("textbox");
      for (let i = 0; i < 4; i += 1) {
        fireEvent.keyDown(input, { key: "ArrowDown" });
      }

      expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    });

    it("wraps backwards from the first item to the last", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowUp" });

      const options = screen.getAllByRole("option");
      expect(options[options.length - 1]).toHaveAttribute("aria-selected", "true");
    });

    it("selects the highlighted entry with Enter", () => {
      const onSelect = vi.fn();
      render(<AddressBookPicker onSelect={onSelect} />);
      openPicker();

      const input = screen.getByRole("textbox");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });

      // Bob is the favourite, so he sorts first.
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ label: "Bob" }));
    });

    it("does nothing on Enter when nothing is highlighted", () => {
      const onSelect = vi.fn();
      render(<AddressBookPicker onSelect={onSelect} />);
      openPicker();

      fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("resets the highlight when the search changes", () => {
      // The list underneath just changed; keeping the index would highlight an
      // unrelated row.
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      const input = screen.getByRole("textbox");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.change(input, { target: { value: "Alice" } });

      expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "false");
    });
  });

  describe("accessibility", () => {
    it("marks the trigger as a listbox popup owner", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);

      expect(
        screen.getByRole("button", { name: "Pick from address book" }),
      ).toHaveAttribute("aria-haspopup", "listbox");
    });

    it("gives the list an accessible name", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      expect(screen.getByRole("listbox")).toHaveAccessibleName("Saved contacts");
    });

    it("labels the search input for screen readers", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      expect(screen.getByRole("textbox")).toHaveAccessibleName("Search by address or label…");
    });

    it("marks exactly one option selected at a time", () => {
      render(<AddressBookPicker onSelect={vi.fn()} />);
      openPicker();

      const input = screen.getByRole("textbox");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });

      const selected = screen
        .getAllByRole("option")
        .filter((li) => li.getAttribute("aria-selected") === "true");
      expect(selected).toHaveLength(1);
    });
  });
});
