import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ShortcutReferenceModal } from "./ShortcutReferenceModal";
import { KeyboardShortcutsProvider } from "./KeyboardShortcutsProvider";
import { Footer } from "@/components/layout/Footer";

describe("ShortcutReferenceModal", () => {
  it("groups shortcuts by the requested contexts and closes on Escape", () => {
    const onClose = vi.fn();
    render(<ShortcutReferenceModal open onClose={onClose} />);

    expect(
      screen.getByRole("heading", { name: "Navigation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Marketplace" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps focus inside the dialog", () => {
    render(<ShortcutReferenceModal open onClose={() => undefined} />);
    const close = screen.getByRole("button", {
      name: "Close shortcuts reference",
    });
    close.focus();
    fireEvent.keyDown(close, { key: "Tab" });
    expect(document.activeElement).toBe(close);
  });
});

describe("Footer shortcut link", () => {
  it("dispatches the global modal event", async () => {
    const listener = vi.fn();
    window.addEventListener("kora:open-shortcut-modal", listener);
    render(<Footer />);
    await userEvent.click(
      screen.getByRole("button", { name: "Keyboard Shortcuts" }),
    );
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("kora:open-shortcut-modal", listener);
  });
});

describe("question-mark shortcut", () => {
  it("opens globally but does not fire while typing", () => {
    render(
      <>
        <input aria-label="Search invoices" />
        <KeyboardShortcutsProvider />
      </>,
    );

    const input = screen.getByRole("textbox", { name: "Search invoices" });
    input.focus();
    fireEvent.keyDown(document, { key: "?" });
    expect(
      screen.queryByRole("dialog", { name: "Keyboard Shortcuts" }),
    ).not.toBeInTheDocument();

    input.blur();
    fireEvent.keyDown(document, { key: "?" });
    expect(
      screen.getByRole("dialog", { name: "Keyboard Shortcuts" }),
    ).toBeInTheDocument();
  });
});

describe("Ctrl+Shift+V — Web Vitals toggle shortcut", () => {
  it("dispatches kora:toggle-webvitals when devtools are enabled", () => {
    // Simulate NEXT_PUBLIC_ENABLE_DEVTOOLS=true at runtime
    const originalEnv = process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS;
    process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS = "true";

    const listener = vi.fn();
    window.addEventListener("kora:toggle-webvitals", listener);

    render(<KeyboardShortcutsProvider />);

    fireEvent.keyDown(document, { key: "v", ctrlKey: true, shiftKey: true });
    expect(listener).toHaveBeenCalledOnce();

    window.removeEventListener("kora:toggle-webvitals", listener);
    process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS = originalEnv;
  });

  it("does NOT dispatch kora:toggle-webvitals when devtools are disabled", () => {
    const originalEnv = process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS;
    process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS = undefined as unknown as string;

    const listener = vi.fn();
    window.addEventListener("kora:toggle-webvitals", listener);

    render(<KeyboardShortcutsProvider />);

    fireEvent.keyDown(document, { key: "v", ctrlKey: true, shiftKey: true });
    expect(listener).not.toHaveBeenCalled();

    window.removeEventListener("kora:toggle-webvitals", listener);
    process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS = originalEnv;
  });
});
