const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'PhaseMonitoreo.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// Each key is the mojibake string, value is the correct Unicode character.
// These mojibake sequences come from UTF-8 bytes being misread as Windows-1252
// and then re-encoded as UTF-8.
const fixes = [
  // Multi-character sequences must come BEFORE their substrings
  ['\u00e2\u20ac\u00a2', '\u2022'],   // â€¢ → •  (bullet)
  ['\u00e2\u20ac\u0153', '\u201c'],   // â€œ → "  (left double quote)
  ['\u00e2\u20ac\u009d', '\u201d'],   // â€  → "  (right double quote)
  ['\u00e2\u20ac\u02dc', '\u02dc'],   // â€˜ (may not appear, safety)
  ['\u00e2\u20ac\u2122', '\u2019'],   // â€™ → '  (right single quote)
  ['\u00e2\u20ac\u201c', '\u2013'],   // â€" → –  (en-dash)
  ['\u00e2\u20ac\u201d', '\u2014'],   // â€" → —  (em-dash, if present)
  // Single accented characters (Ã + combining byte)
  ['\u00c3\u00b3', '\u00f3'],   // Ã³ → ó
  ['\u00c3\u2019', '\u00d3'],   // Ã" → Ó  (0xD3)
  ['\u00c3\u00b1', '\u00f1'],   // Ã± → ñ
  ['\u00c3\u2018', '\u00d1'],   // Ã' → Ñ  (0xD1)
  ['\u00c3\u00ad', '\u00ed'],   // Ã­ → í
  ['\u00c3\u00a9', '\u00e9'],   // Ã© → é
  ['\u00c3\u2030', '\u00c9'],   // Ã‰ → É  (0xC9)
  ['\u00c3\u00a1', '\u00e1'],   // Ã¡ → á
  ['\u00c3\u201a', '\u00c2'],   // Ã‚ → Â  (0xC2)
  ['\u00c3\u0081', '\u00c1'],   // Ã (ctrl-A) → Á  (0xC1) — displayed as Ã<space> in some terminals
  ['\u00c3\u00bc', '\u00fc'],   // Ã¼ → ü
  ['\u00c3\u00ba', '\u00fa'],   // Ãº → ú
  ['\u00c3\u00b9', '\u00f9'],   // Ã¹ → ù
  ['\u00c3\u009c', '\u00dc'],   // Ãœ → Ü  (0xDC)
  ['\u00c3\u00aa', '\u00ea'],   // Ãª → ê
  ['\u00c3\u00a0', '\u00e0'],   // Ã  → à (0xE0) - only if not Á
  ['\u00c3\u0089', '\u00c9'],   // duplicate safety for É
];

let count = 0;
for (const [bad, good] of fixes) {
  const before = content;
  // Use split/join for global replace without regex special char issues
  content = content.split(bad).join(good);
  if (content !== before) {
    const n = (before.split(bad).length - 1);
    console.log(`Replaced ${n}x  [${bad}] → [${good}]`);
    count += n;
  }
}

// Also fix the "Ã " (Ã + regular space) that shows up for Á in some cases
// by doing a targeted fix
const before2 = content;
content = content.split('\u00c3 ').join('\u00c1');
if (content !== before2) {
  const n = (before2.split('\u00c3 ').length - 1);
  console.log(`Replaced ${n}x  [Ã<space>] → [Á]`);
  count += n;
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone. Total replacements: ${count}`);
