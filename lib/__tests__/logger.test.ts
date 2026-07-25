import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../logger";

describe("Structured Logger", () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("should output valid JSON with required fields", () => {
    logger.info("Test message", { requestId: "req-123", route: "/api/test" });

    expect(consoleSpy).toHaveBeenCalledOnce();
    const logString = consoleSpy.mock.calls[0][0];
    const logObj = JSON.parse(logString);

    expect(logObj).toHaveProperty("timestamp");
    expect(logObj.level).toBe("info");
    expect(logObj.message).toBe("Test message");
    expect(logObj.requestId).toBe("req-123");
    expect(logObj.route).toBe("/api/test");
  });

  it("should redact sensitive fields", () => {
    logger.warn("Warning sensitive", {
      requestId: "req-456",
      route: "/api/secure",
      password: "my-secret-password",
      apiToken: "super-secret-token",
      authorization: "Bearer key123",
      nested: {
        cookie: "session=xyz",
        safeField: "safe-value",
      },
    });

    const logObj = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logObj.password).toBe("[REDACTED]");
    expect(logObj.apiToken).toBe("[REDACTED]");
    expect(logObj.authorization).toBe("[REDACTED]");
    expect(logObj.nested.cookie).toBe("[REDACTED]");
    expect(logObj.nested.safeField).toBe("safe-value");
  });

  it("should serialize Error objects", () => {
    const testError = new Error("Something went wrong");
    logger.error("Error occurred", {
      requestId: "req-789",
      route: "/api/error",
      error: testError,
    });

    const logObj = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logObj.error).toHaveProperty("name", "Error");
    expect(logObj.error).toHaveProperty("message", "Something went wrong");
    expect(logObj.error).toHaveProperty("stack");
  });
});
