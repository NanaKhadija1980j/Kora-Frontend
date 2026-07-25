/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
module.exports = {
  _comment: "Stryker Mutator configuration for Kora Frontend",
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress"],
  testRunner: "vitest",
  testRunner_nodeArgs: [],
  mutate: [
    "lib/utils.ts",
    "store/invoiceStore.ts"
  ],
  tempDirName: "stryker-tmp",
  cleanTempDir: true,
  vitest: {
    configFile: "vitest.config.ts"
  },
  thresholds: {
    high: 80,
    low: 70,
    break: 70
  },
  concurrency: 2
};
