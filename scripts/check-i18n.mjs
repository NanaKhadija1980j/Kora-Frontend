#!/usr/bin/env node
/**
 * check-i18n.mjs
 *
 * Checks that all non-English locale files have full key parity with en.json.
 * Optionally also reports unused keys in en.json (keys defined but never
 * referenced via t("...") in source files).
 *
 * Usage:
 *   node scripts/check-i18n.mjs
 *   node scripts/check-i18n.mjs --unused
 *   node scripts/check-i18n.mjs --unused --strict
 *   node scripts/check-i18n.mjs --fix
 *
 * Options:
 *   --fix     Print a summary of fixes needed (does not auto-fix)
 *   --unused  Also scan source files for unused translation keys
 *   --strict  Exit with code 1 when unused keys are found (for CI)
 *
 * Limitations (best-effort unused-key detection):
 *   - Only detects statically-visible t("...") calls; dynamic keys
 *     constructed via string concatenation (t("key." + var)) or template
 *     literals with interpolation (t(`key${var}`)) are not caught.
 *   - Keys accessed via a variable (t(someKey)) cannot be traced statically.
 *   - Keys used only in test files or e2e specs may be reported as unused
 *     if they are not referenced in production source code.
 *   - The allowlist at the top of the file can be extended for known
 *     dynamic key prefixes that should be excluded from the unused-key report.
 *   - The scan covers .ts, .tsx, .js, .jsx files under app/, components/,
 *     hooks/, lib/, store/, middleware.ts, and i18n/.  Files outside these
 *     directories are not scanned.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MESSAGES_DIR = join(ROOT, "messages");

const LOCALES = ["es", "ar", "pt-BR"];

/**
 * Directories and files to scan for t("...") usage.
 */
const SCAN_ROOTS = [
  join(ROOT, "app"),
  join(ROOT, "components"),
  join(ROOT, "hooks"),
  join(ROOT, "lib"),
  join(ROOT, "store"),
  join(ROOT, "i18n"),
  join(ROOT, "middleware.ts"),
];

/**
 * File extensions to include in the scan.
 */
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

/**
 * Directories to skip during recursive directory traversal.
 */
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git"]);

/**
 * Allowlist of key prefixes that are known to be used dynamically
 * (e.g. constructed via string concatenation or template interpolation)
 * and should not be flagged as unused.
 *
 * Extend this array when you add a new dynamic key pattern that
 * cannot be statically detected by the t("...") regex scanner.
 *
 * Example:
 *   "commandPalette."  // catches t("commandPalette." + var)
 */
const ALLOWLIST_PREFIXES = [];

/**
 * Recursively collect all dot-notation key paths from a nested object.
 * @param {Record<string, unknown>} obj
 * @param {string} prefix
 * @returns {string[]}
 */
function collectKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      keys.push(...collectKeys(val, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function loadJson(locale) {
  const path = join(MESSAGES_DIR, `${locale}.json`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`❌  Could not read ${locale}.json: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Recursively collect all source file paths under the given root.
 * Skips directories in SKIP_DIRS and files with non-matching extensions.
 * @param {string} root
 * @returns {string[]}
 */
function collectSourceFiles(root) {
  const files = [];
  if (!existsSync(root)) return files;
  const entry = statSync(root);
  if (entry.isFile()) {
    if (SCAN_EXTENSIONS.has(extname(root))) {
      files.push(root);
    }
    return files;
  }
  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) {
        files.push(...collectSourceFiles(fullPath));
      }
    } else if (stat.isFile() && SCAN_EXTENSIONS.has(extname(entry))) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Scan a source file for t("...") / t('...') calls and extract the
 * translation keys used.  Handles:
 *   t("key")
 *   t("key.subkey")
 *   t("key", { values })
 *
 * Does NOT handle dynamic keys like t("key." + var) or t(`key${var}`).
 * @param {string} filePath
 * @returns {string[]}
 */
function extractKeysFromFile(filePath) {
  const keys = [];
  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return keys;
  }

  // Match t("key") or t('key') — optionally followed by a comma and more args.
  // This captures static string keys only.
  const staticKeyRegex = /t\s*\(\s*["']([^"']+)["']/g;
  let match;
  while ((match = staticKeyRegex.exec(content)) !== null) {
    keys.push(match[1]);
  }

  return keys;
}

/**
 * Scan all source files and return the set of all translation keys
 * that are referenced via t("...") calls.
 * @returns {Set<string>}
 */
function collectUsedKeys() {
  const usedKeys = new Set();

  for (const root of SCAN_ROOTS) {
    const files = collectSourceFiles(root);
    for (const file of files) {
      const keys = extractKeysFromFile(file);
      for (const key of keys) {
        usedKeys.add(key);
      }
    }
  }

  return usedKeys;
}

/**
 * Check for unused keys in en.json that are never referenced in source files.
 * Keys whose prefix matches an entry in ALLOWLIST_PREFIXES are skipped.
 * @param {Set<string>} allEnKeys
 * @param {Set<string>} usedKeys
 * @returns {string[]} sorted list of unused key paths
 */
function findUnusedKeys(allEnKeys, usedKeys) {
  const unused = [];
  for (const key of allEnKeys) {
    if (usedKeys.has(key)) continue;

    // Check if the key matches any allowlist prefix.
    const isAllowlisted = ALLOWLIST_PREFIXES.some((prefix) => key.startsWith(prefix));
    if (isAllowlisted) continue;

    unused.push(key);
  }
  return unused.sort();
}

// ── Main ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const doFix = args.includes("--fix");
const doUnused = args.includes("--unused");
const strict = args.includes("--strict");

const en = loadJson("en");
const enKeys = new Set(collectKeys(en));

let totalMissing = 0;
let totalExtra = 0;

for (const locale of LOCALES) {
  const messages = loadJson(locale);
  const localeKeys = new Set(collectKeys(messages));

  const missing = [...enKeys].filter((k) => !localeKeys.has(k));
  const extra = [...localeKeys].filter((k) => !enKeys.has(k));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`✅  ${locale}: full parity (${enKeys.size} keys)`);
  } else {
    if (missing.length > 0) {
      console.error(`\n❌  ${locale}: ${missing.length} missing key(s):`);
      for (const k of missing) {
        console.error(`     - ${k}`);
      }
      totalMissing += missing.length;
    }
    if (extra.length > 0) {
      console.warn(`\n⚠️   ${locale}: ${extra.length} extra key(s) not in en.json:`);
      for (const k of extra) {
        console.warn(`     + ${k}`);
      }
      totalExtra += extra.length;
    }
  }
}

let exitCode = 0;
let unusedKeys = [];

if (totalMissing > 0) {
  console.error(
    `\n❌  i18n check failed: ${totalMissing} missing key(s) across locale files.\n` +
    `   Add the missing keys to the relevant locale files and re-run.\n`
  );
  exitCode = 1;
}

if (totalExtra > 0) {
  console.warn(
    `\n⚠️   i18n check passed with warnings: ${totalExtra} extra key(s) found.\n` +
    `   Consider removing orphaned keys or adding them to en.json.\n`
  );
}

// ── Unused-key detection ──────────────────────────────────────

if (doUnused) {
  console.log("\n🔍  Scanning source files for unused translation keys …");

  const usedKeys = collectUsedKeys();
  unusedKeys = findUnusedKeys(enKeys, usedKeys);

  if (unusedKeys.length === 0) {
    console.log("✅  No unused translation keys found.\n");
  } else {
    console.warn(`\n⚠️   ${unusedKeys.length} unused translation key(s) found in en.json:\n`);
    for (const key of unusedKeys) {
      console.warn(`     - ${key}`);
    }
    console.warn("");

    if (strict) {
      console.error(
        `❌  Unused-key check failed: ${unusedKeys.length} unused key(s) found.\n` +
        `   Remove the keys or add them to ALLOWLIST_PREFIXES in scripts/check-i18n.mjs.\n`
      );
      exitCode = 1;
    } else {
      console.warn(
        `ℹ️   Run with --strict to fail CI on unused keys, or add them to ALLOWLIST_PREFIXES.\n`
      );
    }
  }
}

if (exitCode === 0) {
  console.log("\n✅  i18n key parity check passed.\n");
}

process.exit(exitCode);
