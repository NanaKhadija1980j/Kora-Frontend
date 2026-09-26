import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useFocusTrap, type UseFocusTrapOptions } from "../useFocusTrap";

interface TestComponentProps {
  active?: boolean;
  options?: UseFocusTrapOptions;
  hasButtons?: boolean;
  renderDisabled?: boolean;
}

function TestModal({
  active = true,
  options = {},
  hasButtons = true,
  renderDisabled = false,
}: TestComponentProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(active, options);

  return (
    <div ref={trapRef} role="dialog" aria-modal="true" data-testid="dialog">
      {hasButtons ? (
        <>
          <button data-testid="btn-first">First Button</button>
          {renderDisabled && (
            <>
              <button disabled data-testid="btn-disabled">
                Disabled Button
              </button>
              <button aria-hidden="true" data-testid="btn-aria-hidden">
                Aria Hidden
              </button>
            </>
          )}
          <input data-testid="input-middle" placeholder="Middle Input" />
          <button data-testid="btn-last">Last Button</button>
        </>
      ) : (
        <p>Empty dialog</p>
      )}
    </div>
  );
}

describe("useFocusTrap", () => {
  let originalGetClientRects: () => DOMRectList;

  beforeEach(() => {
    originalGetClientRects = HTMLElement.prototype.getClientRects;
    HTMLElement.prototype.getClientRects = function () {
      if (this.style.display === "none" || this.getAttribute("aria-hidden") === "true") {
        return [] as unknown as DOMRectList;
      }
      return [{ width: 100, height: 20 }] as unknown as DOMRectList;
    };
  });

  afterEach(() => {
    HTMLElement.prototype.getClientRects = originalGetClientRects;
    vi.restoreAllMocks();
  });

  describe("activate and deactivate", () => {
    it("moves focus to the first focusable element when activated", () => {
      const trigger = document.createElement("button");
      document.body.appendChild(trigger);
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      render(<TestModal active={true} />);

      expect(document.activeElement).toBe(screen.getByTestId("btn-first"));
      document.body.removeChild(trigger);
    });

    it("focuses the container itself when no focusable elements are present", () => {
      render(<TestModal active={true} hasButtons={false} />);

      const dialog = screen.getByTestId("dialog");
      expect(dialog.getAttribute("tabindex")).toBe("-1");
      expect(document.activeElement).toBe(dialog);
    });

    it("does not engage focus trap when active is false", () => {
      const trigger = document.createElement("button");
      document.body.appendChild(trigger);
      trigger.focus();

      render(<TestModal active={false} />);

      expect(document.activeElement).toBe(trigger);
      document.body.removeChild(trigger);
    });

    it("restores focus to previously focused element upon deactivation", () => {
      const trigger = document.createElement("button");
      document.body.appendChild(trigger);
      trigger.focus();

      function Parent() {
        const [active, setActive] = useState(true);
        return (
          <>
            <button data-testid="toggle-btn" onClick={() => setActive(false)}>
              Close
            </button>
            <TestModal active={active} />
          </>
        );
      }

      render(<Parent />);
      expect(document.activeElement).toBe(screen.getByTestId("btn-first"));

      fireEvent.click(screen.getByTestId("toggle-btn"));
      expect(document.activeElement).toBe(trigger);
      document.body.removeChild(trigger);
    });

    it("does not restore focus if restoreFocus is set to false", () => {
      const trigger = document.createElement("button");
      document.body.appendChild(trigger);
      trigger.focus();

      function Parent() {
        const [active, setActive] = useState(true);
        return (
          <>
            <button data-testid="toggle-btn" onClick={() => setActive(false)}>
              Close
            </button>
            <TestModal active={active} options={{ restoreFocus: false }} />
          </>
        );
      }

      render(<Parent />);
      expect(document.activeElement).toBe(screen.getByTestId("btn-first"));

      fireEvent.click(screen.getByTestId("toggle-btn"));
      expect(document.activeElement).not.toBe(trigger);
      document.body.removeChild(trigger);
    });
  });

  describe("Tab cycling", () => {
    it("cycles from last focusable element to first when Tab is pressed", () => {
      render(<TestModal active={true} />);

      const lastBtn = screen.getByTestId("btn-last");
      const firstBtn = screen.getByTestId("btn-first");

      lastBtn.focus();
      expect(document.activeElement).toBe(lastBtn);

      const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
      document.dispatchEvent(event);

      expect(document.activeElement).toBe(firstBtn);
      expect(event.defaultPrevented).toBe(true);
    });

    it("cycles from first focusable element to last when Shift+Tab is pressed", () => {
      render(<TestModal active={true} />);

      const firstBtn = screen.getByTestId("btn-first");
      const lastBtn = screen.getByTestId("btn-last");

      firstBtn.focus();
      expect(document.activeElement).toBe(firstBtn);

      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);

      expect(document.activeElement).toBe(lastBtn);
      expect(event.defaultPrevented).toBe(true);
    });

    it("pulls focus into first element when activeElement is outside on Tab", () => {
      const outside = document.createElement("button");
      document.body.appendChild(outside);

      render(<TestModal active={true} />);

      outside.focus();
      expect(document.activeElement).toBe(outside);

      const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
      document.dispatchEvent(event);

      expect(document.activeElement).toBe(screen.getByTestId("btn-first"));
      expect(event.defaultPrevented).toBe(true);
      document.body.removeChild(outside);
    });

    it("pulls focus into last element when activeElement is outside on Shift+Tab", () => {
      const outside = document.createElement("button");
      document.body.appendChild(outside);

      render(<TestModal active={true} />);

      outside.focus();
      expect(document.activeElement).toBe(outside);

      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);

      expect(document.activeElement).toBe(screen.getByTestId("btn-last"));
      expect(event.defaultPrevented).toBe(true);
      document.body.removeChild(outside);
    });

    it("skips disabled and aria-hidden elements", () => {
      render(<TestModal active={true} renderDisabled={true} />);

      const firstBtn = screen.getByTestId("btn-first");
      const lastBtn = screen.getByTestId("btn-last");

      firstBtn.focus();

      // Tab backward should go to lastBtn directly, not aria-hidden or disabled
      const shiftTab = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(shiftTab);
      expect(document.activeElement).toBe(lastBtn);

      // Tab forward should wrap to firstBtn
      const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
      document.dispatchEvent(tab);
      expect(document.activeElement).toBe(firstBtn);
    });
  });

  describe("Escape key handling", () => {
    it("calls onEscape when Escape key is pressed", () => {
      const onEscape = vi.fn();
      render(<TestModal active={true} options={{ onEscape }} />);

      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

      document.dispatchEvent(event);

      expect(onEscape).toHaveBeenCalledOnce();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it("updates onEscape callback without tearing down trap", () => {
      const onEscape1 = vi.fn();
      const onEscape2 = vi.fn();

      const { rerender } = render(<TestModal active={true} options={{ onEscape: onEscape1 }} />);

      const middleInput = screen.getByTestId("input-middle");
      middleInput.focus();
      expect(document.activeElement).toBe(middleInput);

      rerender(<TestModal active={true} options={{ onEscape: onEscape2 }} />);

      // Focus should not have reset to firstBtn
      expect(document.activeElement).toBe(middleInput);

      const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
      document.dispatchEvent(event);

      expect(onEscape1).not.toHaveBeenCalled();
      expect(onEscape2).toHaveBeenCalledOnce();
    });
  });

  describe("cleanup on unmount", () => {
    it("removes event listener and restores focus on unmount", () => {
      const trigger = document.createElement("button");
      document.body.appendChild(trigger);
      trigger.focus();

      const onEscape = vi.fn();
      const { unmount } = render(<TestModal active={true} options={{ onEscape }} />);

      expect(document.activeElement).toBe(screen.getByTestId("btn-first"));

      unmount();

      // Focus restored to trigger button
      expect(document.activeElement).toBe(trigger);

      // Escape should no longer call onEscape
      const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
      document.dispatchEvent(event);
      expect(onEscape).not.toHaveBeenCalled();

      document.body.removeChild(trigger);
    });
  });
});
