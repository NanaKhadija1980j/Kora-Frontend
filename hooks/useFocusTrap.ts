"use client";

/**
 * useFocusTrap — WCAG-compliant focus management for modal surfaces (Issue #439)
 *
 * Hand-rolled modal surfaces (`role="dialog"` + `aria-modal="true"`) that are not
 * built on Radix's Dialog primitive get no focus management for free. Without it
 * they fail WCAG 2.1 SC 2.1.2 (No Keyboard Trap) and 2.4.3 (Focus Order): Tab
 * walks straight out of the dialog and into the page behind it, which is still
 * rendered and still focusable, leaving keyboard and screen-reader users
 * stranded in content the dialog claims to have covered.
 *
 * This hook provides the three behaviours a modal owes its users:
 *
 * 1. **Initial focus** — moves focus into the dialog on open, so the next Tab
 *    lands on the dialog's own controls rather than the document body.
 * 2. **Containment** — Tab from the last focusable element wraps to the first,
 *    Shift+Tab from the first wraps to the last.
 * 3. **Restoration** — returns focus to whatever was focused before the dialog
 *    opened (usually the trigger button), so closing does not dump the user
 *    back at the top of the document.
 *
 * Escape-to-close is included because a trapped surface must always offer a
 * keyboard exit.
 *
 * Usage:
 *   const ref = useFocusTrap<HTMLDivElement>(open, { onEscape: () => setOpen(false) });
 *   return <div ref={ref} role="dialog" aria-modal="true">…</div>;
 */

import { useEffect, useRef } from "react";

/**
 * Elements that can receive keyboard focus.
 *
 * `[tabindex="-1"]` is deliberately excluded: such elements are
 * programmatically focusable but are not part of the Tab sequence, so cycling
 * through them would not match what a keyboard user actually experiences.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Focusable descendants that are actually visible and reachable right now. */
function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("aria-hidden") !== "true" &&
      // offsetParent is null for display:none subtrees. Elements inside a
      // `position: fixed` container report null too, so fall back to measuring
      // the box — the drawer itself is fixed-positioned.
      (el.offsetParent !== null || el.getClientRects().length > 0),
  );
}

export interface UseFocusTrapOptions {
  /** Called when Escape is pressed inside the trap. */
  onEscape?: () => void;
  /**
   * Restore focus to the previously focused element on deactivate.
   * @default true
   */
  restoreFocus?: boolean;
}

/**
 * Trap keyboard focus inside the returned ref while `active` is true.
 *
 * @param active   Whether the trap is engaged (i.e. the dialog is open).
 * @param options  Escape handler and focus-restoration behaviour.
 * @returns        Ref to attach to the element that should contain focus.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  options: UseFocusTrapOptions = {},
) {
  const { onEscape, restoreFocus = true } = options;
  const containerRef = useRef<T | null>(null);

  // Held in a ref so a changing onEscape identity does not tear down and
  // re-run the trap (which would steal focus back to the first element).
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Move focus inside. Prefer the first real control; fall back to the
    // container itself (made programmatically focusable) when the dialog is
    // empty, e.g. an empty-state with no buttons.
    const initial = getFocusable(container);
    if (initial.length > 0) {
      initial[0].focus();
    } else {
      container.setAttribute("tabindex", "-1");
      container.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onEscapeRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      // Recomputed per keypress: drawer content swaps between the list and the
      // detail view, so a list captured on open would go stale.
      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        // Nothing to move to — keep focus pinned rather than letting it escape.
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement;

      if (event.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (activeEl === last || !container.contains(activeEl)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (restoreFocus && previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [active, restoreFocus]);

  return containerRef;
}
