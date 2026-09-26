/**
 * Component tests for ErrorBoundary and ErrorFallback (#824).
 *
 * Covers network / contract / generic error kinds, compact and full variants,
 * custom fallbacks, onError reporting, and reset recovery.
 */

import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary, ErrorFallback } from "../error-boundary";

const NETWORK_TITLE = "Connection error";
const CONTRACT_TITLE = "Contract error";
const GENERIC_TITLE = "Something went wrong";

function Thrower({ message }: { message: string }): React.ReactElement {
  throw new Error(message);
}

describe("ErrorFallback", () => {
  describe("error kinds", () => {
    it.each(["Failed to fetch", "Network request failed", "Request timeout", "fetch aborted"])(
      "classifies %j as a network error",
      (message) => {
        render(<ErrorFallback error={new Error(message)} reset={vi.fn()} />);

        expect(screen.getByText(NETWORK_TITLE)).toBeInTheDocument();
        expect(screen.getByText(/Unable to reach the network/i)).toBeInTheDocument();
      }
    );

    it.each(["Soroban RPC error", "contract panicked", "Simulation failed", "Stellar tx rejected", "bad XDR"])(
      "classifies %j as a contract error",
      (message) => {
        render(<ErrorFallback error={new Error(message)} reset={vi.fn()} />);

        expect(screen.getByText(CONTRACT_TITLE)).toBeInTheDocument();
        expect(screen.getByText(/A smart contract call failed/i)).toBeInTheDocument();
      }
    );

    it("falls back to the generic kind for unrecognised errors", () => {
      render(<ErrorFallback error={new Error("Cannot read properties of null")} reset={vi.fn()} />);

      expect(screen.getByText(GENERIC_TITLE)).toBeInTheDocument();
      expect(screen.getByText(/An unexpected error occurred/i)).toBeInTheDocument();
    });

    it("prefers network over contract when both keywords appear", () => {
      render(<ErrorFallback error={new Error("contract call timeout")} reset={vi.fn()} />);

      expect(screen.getByText(NETWORK_TITLE)).toBeInTheDocument();
      expect(screen.queryByText(CONTRACT_TITLE)).not.toBeInTheDocument();
    });
  });

  describe("reset", () => {
    it("calls reset from the Try Again button", async () => {
      const reset = vi.fn();
      const user = userEvent.setup();
      render(<ErrorFallback error={new Error("boom")} reset={reset} />);

      await user.click(screen.getByRole("button", { name: /Try Again/i }));
      expect(reset).toHaveBeenCalledTimes(1);
    });

    it("calls reset from the compact Retry button", async () => {
      const reset = vi.fn();
      const user = userEvent.setup();
      render(<ErrorFallback error={new Error("Failed to fetch")} reset={reset} compact />);

      expect(screen.getByText(NETWORK_TITLE)).toBeInTheDocument();
      expect(screen.queryByText(/Unable to reach the network/i)).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Retry" }));
      expect(reset).toHaveBeenCalledTimes(1);
    });
  });

  describe("raw error message", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("shows the raw message in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      render(<ErrorFallback error={new Error("secret stack detail")} reset={vi.fn()} />);

      expect(screen.getByText("secret stack detail")).toBeInTheDocument();
    });

    it("hides the raw message outside development", () => {
      vi.stubEnv("NODE_ENV", "production");
      render(<ErrorFallback error={new Error("secret stack detail")} reset={vi.fn()} />);

      expect(screen.queryByText("secret stack detail")).not.toBeInTheDocument();
    });
  });
});

describe("ErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>Healthy content</p>
      </ErrorBoundary>
    );

    expect(screen.getByText("Healthy content")).toBeInTheDocument();
  });

  it.each([
    ["Failed to fetch", NETWORK_TITLE],
    ["Soroban simulation failed", CONTRACT_TITLE],
    ["undefined is not a function", GENERIC_TITLE],
  ])("renders the default fallback for %j", (message, title) => {
    render(
      <ErrorBoundary>
        <Thrower message={message} />
      </ErrorBoundary>
    );

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();
  });

  it("renders the compact fallback when compact is set", () => {
    render(
      <ErrorBoundary compact>
        <Thrower message="Soroban error" />
      </ErrorBoundary>
    );

    expect(screen.getByText(CONTRACT_TITLE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Try Again/i })).not.toBeInTheDocument();
  });

  it("logs and reports the error through onError", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Thrower message="reported failure" />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    const [error, info] = onError.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("reported failure");
    expect(info).toHaveProperty("componentStack");
    expect(consoleErrorSpy).toHaveBeenCalledWith("[ErrorBoundary]", error, info.componentStack);
  });

  it("uses a custom fallback with the error and reset", () => {
    const fallback = vi.fn((error: Error) => <p>Custom: {error.message}</p>);
    render(
      <ErrorBoundary fallback={fallback}>
        <Thrower message="custom failure" />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom: custom failure")).toBeInTheDocument();
    expect(screen.queryByText(GENERIC_TITLE)).not.toBeInTheDocument();
    expect(fallback).toHaveBeenCalledWith(expect.any(Error), expect.any(Function));
  });

  function Recoverable() {
    const [shouldThrow, setShouldThrow] = useState(true);
    return (
      <>
        <button type="button" onClick={() => setShouldThrow(false)}>
          Fix
        </button>
        <ErrorBoundary
          fallback={(error, reset) => (
            <button type="button" onClick={reset}>
              Reset {error.message}
            </button>
          )}
        >
          {shouldThrow ? <Thrower message="flaky" /> : <p>Recovered</p>}
        </ErrorBoundary>
      </>
    );
  }

  it("re-renders children after reset once the cause is fixed", async () => {
    const user = userEvent.setup();
    render(<Recoverable />);

    await user.click(screen.getByRole("button", { name: "Fix" }));
    await user.click(screen.getByRole("button", { name: "Reset flaky" }));

    expect(screen.getByText("Recovered")).toBeInTheDocument();
  });

  it("shows the fallback again if children still throw after reset", async () => {
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Thrower message="Failed to fetch" />
      </ErrorBoundary>
    );

    await user.click(screen.getByRole("button", { name: /Try Again/i }));

    expect(screen.getByText(NETWORK_TITLE)).toBeInTheDocument();
  });
});
