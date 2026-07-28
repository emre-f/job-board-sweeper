#!/usr/bin/env node
// Promote companies into a SHIPPED category (src/common/constants.js), so
// they apply to every user of the extension.
//
// Usage:  npm run promote -- <category-id> "Company One" ["Company Two" ...]
//   e.g.  npm run promote -- job-board "Some Spammer Inc"
//
// Category ids are listed in constants.js (e.g. job-board, ai-labelling).
// After promoting, reload the extension in chrome://extensions.

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'common', 'constants.js');
const [catId, ...names] = process.argv
  .slice(2)
  .map((s) => s.trim())
  .filter(Boolean);

let src = fs.readFileSync(file, 'utf8');
const knownIds = [...src.matchAll(/id:\s*'([\w-]+)'/g)].map((m) => m[1]);

if (!catId || !names.length || !knownIds.includes(catId)) {
  console.error('Usage: npm run promote -- <category-id> "Company Name" [...more]');
  console.error('Available category ids: ' + knownIds.join(', '));
  process.exit(1);
}

const marker = new RegExp(
  "(id:\\s*'" + catId + "'[\\s\\S]*?companies:\\s*\\[)([\\s\\S]*?)(\\n {6}\\],)"
);
const m = src.match(marker);
if (!m) {
  console.error(`Could not find the companies array for category '${catId}' in ${file}`);
  process.exit(1);
}

const norm = (s) => s.replace(/\s+/g, ' ').trim(); // exact matching - see matcher.js
// Dedupe against ALL categories, not just the target one.
const existing = new Set(
  [...src.matchAll(/'((?:[^'\\]|\\.)+)'/g)].map((x) => norm(x[1])).filter(Boolean)
);
const add = names.filter((n) => !existing.has(norm(n)));
const skipped = names.filter((n) => existing.has(norm(n)));

if (skipped.length) console.log('Already shipped (some category):', skipped.join(', '));
if (!add.length) process.exit(0);

const insert = add.map((n) => `        '${n.replace(/'/g, "\\'")}',`).join('\n');
src = src.replace(marker, (_full, head, body, tail) => head + body + '\n' + insert + tail);
fs.writeFileSync(file, src);
console.log(`Added to '${catId}':`, add.join(', '));
console.log('Now reload the extension in chrome://extensions.');
