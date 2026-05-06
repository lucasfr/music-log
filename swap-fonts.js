#!/usr/bin/env node
// Run this once: node scripts/swap-fonts.js
// Replaces LibreBaskerville → CormorantGaramond and SourceSans3 → Lato
// across all source files.

const fs = require('fs');
const path = require('path');

const targets = [
  'src/screens/HomeScreen.js',
  'src/screens/CalendarScreen.js',
  'src/screens/CompositionsScreen.js',
  'src/screens/StatsScreen.js',
  'src/components/LogModal.js',
  'src/components/LessonModal.js',
  'src/components/SessionDetailModal.js',
  'src/components/LessonDetailModal.js',
  'src/components/SegmentEditor.js',
  'src/components/UI.js',
  'src/components/Form.js',
];

const replacements = [
  ["'LibreBaskerville-Italic'", "'CormorantGaramond-Italic'"],
  ["'LibreBaskerville-Bold'",   "'CormorantGaramond-Bold'"],
  ["'LibreBaskerville'",        "'CormorantGaramond'"],
  ["'SourceSans3-Bold'",        "'Lato-Bold'"],
  ["'SourceSans3-Italic'",      "'Lato'"],
  ["'SourceSans3'",             "'Lato'"],
];

let total = 0;
for (const rel of targets) {
  const full = path.join(__dirname, rel);
  if (!fs.existsSync(full)) { console.log(`SKIP (not found): ${rel}`); continue; }
  let src = fs.readFileSync(full, 'utf8');
  let count = 0;
  for (const [from, to] of replacements) {
    const before = src.split(from).length - 1;
    src = src.split(from).join(to);
    count += before;
  }
  fs.writeFileSync(full, src, 'utf8');
  total += count;
  console.log(`${rel}: ${count} replacements`);
}
console.log(`\nDone. ${total} total replacements.`);
