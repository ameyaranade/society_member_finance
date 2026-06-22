#!/usr/bin/env node
/**
 * check:ux — mechanical floor (UX_INVARIANTS_CHECKLIST.md, Layer A).
 * Pass/fail by grep; never depends on a model remembering. Exit 1 on any hit.
 * Checks grow as code areas appear; see TODOs for the ones pending real code.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const SRC = 'src';
const violations = [];

// Files allowed to define raw colours (the theme token module).
const COLOR_ALLOWLIST = [/src\/theme\//];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (['.ts', '.tsx', '.css'].includes(extname(p))) check(p);
  }
}

function check(file) {
  const unix = file.replace(/\\/g, '/');
  const isThemeFile = COLOR_ALLOWLIST.some((re) => re.test(unix));
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const ln = i + 1;
    // 1) No hardcoded colour literals outside the theme token module.
    if (!isThemeFile) {
      if (/#[0-9a-fA-F]{3,8}\b/.test(line) || /\b(rgb|rgba|hsl|hsla)\s*\(/.test(line)) {
        violations.push(`${unix}:${ln}  hardcoded colour literal (use theme tokens)`);
      }
    }
    // 2) No font-size literal below 13px.
    const m = line.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
    if (m && parseFloat(m[1]) < 13) {
      violations.push(`${unix}:${ln}  font-size < 13px`);
    }
    // 3) No client writes to derived/ledger/audit collections.
    if (/\b(setDoc|updateDoc|deleteDoc|addDoc)\b/.test(line) &&
        /\b(transactions|balances|auditLogs|currentBalance)\b/.test(line)) {
      violations.push(`${unix}:${ln}  client write to a Functions-only collection`);
    }
  });
}

// TODO (add as code lands): repo-layer-only Firestore access; paise-math guard;
// IconButton without aria-label; hardcoded i18n strings.

if (existsSync(SRC)) walk(SRC);

if (violations.length) {
  console.error(`check:ux found ${violations.length} issue(s):`);
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}
console.log('check:ux: clean');
