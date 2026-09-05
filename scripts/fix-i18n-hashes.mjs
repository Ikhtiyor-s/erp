// Fix broken i18n keys by matching hash suffix to the correct key in locale files.
// Source files contain `t("ui__◇◇◇◇_hash")` where the middle bytes are corrupted UTF-8.
// The uz.json (etc.) has the correct key `ui__word_hash` with the same hash.
// Strategy: for each source occurrence, look up by hash, replace with the correct key.
// Additionally: for hashes present in source but missing from a locale, copy uz.json's
// value (or the middle word from the correct key) so the browser stops showing raw keys.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB = join(__dirname, "..", "apps", "web");
const MSG_DIR = join(WEB, "i18n", "messages");
const LOCALES = ["uz.json", "ru.json", "en.json", "uz-cyrl.json"];

function walk(dir, results = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, results);
    } else if (name.endsWith(".tsx") || name.endsWith(".ts")) {
      results.push(p);
    }
  }
  return results;
}

// Load locale data
const locales = {};
for (const lf of LOCALES) {
  locales[lf] = JSON.parse(readFileSync(join(MSG_DIR, lf), "utf8"));
}

// Build hash → best correct key map. Prefer keys without U+FFFD (�).
const hashToCorrectKey = new Map();
for (const lf of LOCALES) {
  const ui = locales[lf].ui || {};
  for (const k of Object.keys(ui)) {
    const m = k.match(/^(ui__.+_([a-f0-9]{8}))$/);
    if (!m) continue;
    const h = m[2];
    const existing = hashToCorrectKey.get(h);
    if (!existing || (existing.includes("�") && !k.includes("�"))) {
      hashToCorrectKey.set(h, k);
    }
  }
}

console.log(`Loaded ${hashToCorrectKey.size} hash→key mappings from locales`);

// Scan source files
const srcFiles = [
  ...walk(join(WEB, "app")),
  ...walk(join(WEB, "components")),
  ...walk(join(WEB, "lib")),
];

const BROKEN_RE = /"(ui__[^"]+?_([a-f0-9]{8}))"/g;
const sourceHashes = new Set();
let filesTouched = 0;
let replacements = 0;
const unmapped = new Set();

for (const f of srcFiles) {
  const original = readFileSync(f, "utf8");
  let changed = 0;
  const updated = original.replace(BROKEN_RE, (full, key, hash) => {
    sourceHashes.add(hash);
    const correct = hashToCorrectKey.get(hash);
    if (!correct) {
      unmapped.add(hash);
      return full;
    }
    if (key === correct) return full;
    // Only replace if current key is broken (contains U+FFFD)
    if (!key.includes("�")) return full;
    changed++;
    return `"${correct}"`;
  });
  if (changed > 0) {
    writeFileSync(f, updated, "utf8");
    filesTouched++;
    replacements += changed;
  }
}

console.log(`Source scan: ${sourceHashes.size} unique hashes in source`);
console.log(`Files rewritten: ${filesTouched}`);
console.log(`Key replacements: ${replacements}`);
console.log(`Unmapped hashes (no correct key found anywhere): ${unmapped.size}`);
if (unmapped.size > 0) {
  console.log("Sample unmapped:", [...unmapped].slice(0, 10));
}

// Cross-locale fill: any correct key present in one locale but missing in another → fill from any locale
// Priority: uz > ru > en > uz-cyrl
const priority = ["uz.json", "ru.json", "en.json", "uz-cyrl.json"];
let filled = 0;
for (const [hash, correctKey] of hashToCorrectKey) {
  const sources = priority.filter((l) => (locales[l].ui || {})[correctKey] != null);
  if (sources.length === 0) continue;
  const donorLocale = sources[0];
  const donorValue = locales[donorLocale].ui[correctKey];
  for (const l of LOCALES) {
    locales[l].ui = locales[l].ui || {};
    if (locales[l].ui[correctKey] == null) {
      locales[l].ui[correctKey] = donorValue;
      filled++;
    }
  }
}

// Write back
for (const l of LOCALES) {
  writeFileSync(join(MSG_DIR, l), JSON.stringify(locales[l], null, 2) + "\n", "utf8");
}
console.log(`Cross-locale fill: ${filled} entries copied`);
