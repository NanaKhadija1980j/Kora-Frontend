/**
 * Simulation error mapping tests — Issue #385
 */

import { describe, it, expect } from "vitest";
import { mapSimulationError, parseSorobanError } from "@/lib/stellar/simulationErrors";

describe("parseSorobanError / mapSimulationError (simulation error mapping)", () => {
  it("maps known contract error codes to readable messages", () => {
    expect(parseSorobanError("Error(Contract, #4)")).toBe(
      "Unauthorized: caller is not the owner"
    );
    expect(mapSimulationError("HostError: Error(Contract, #3)")).toBe(
      "Insufficient balance"
    );
    expect(parseSorobanError("Simulation failed: Error(Contract, #1)")).toBe(
      "Invoice not found"
    );
    expect(parseSorobanError("#5 something")).toBe(
      "Invoice has already been repaid"
    );
  });

  it("falls back to Contract error #N for unknown codes", () => {
    expect(parseSorobanError("Error(Contract, #99)")).toBe("Contract error #99");
  });

  it("passes through errors without a numeric code", () => {
    expect(parseSorobanError("Simulation timed out after 10 seconds")).toBe(
      "Simulation timed out after 10 seconds"
    );
  });
});

describe("simulation errors block signing", () => {
  it("preview with error is not proceedable", () => {
    const preview = {
      feeStroops: 0,
      feeXlm: 0,
      resourceFee: 0,
      cpuInstructions: 0,
      memoryBytes: 0,
      readBytes: 0,
      writeBytes: 0,
      error: mapSimulationError("Error(Contract, #4)"),
    };
    const isSimulating = false;
    const hasError = Boolean(preview.error);
    const canProceed = !isSimulating && !hasError;
    expect(canProceed).toBe(false);
    expect(preview.error).toBe("Unauthorized: caller is not the owner");
  });

  it("successful preview allows proceed", () => {
    const preview = {
      feeStroops: 1000,
      feeXlm: 0.0001,
      resourceFee: 1000,
      cpuInstructions: 100,
      memoryBytes: 0,
      readBytes: 0,
      writeBytes: 0,
    };
    const canProceed = !Boolean(preview.error);
    expect(canProceed).toBe(true);
  });
});
