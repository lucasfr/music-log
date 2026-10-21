// A static check of the whole app: every source file parses, every relative import points at a file that
// exists, and every name imported from one of the app's own modules is really exported by it. Lint and
// the unit tests can't see these, and a missing export is only undefined on a phone, where it crashes
// the first time it is used.
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import babel from '@babel/core';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules') out.push(...sourceFiles(p)); }
    else if (/\.js$/.test(name)) out.push(p);
  }
  return out;
}

// @babel/core is already a dependency of the app, and parses exactly the syntax Metro will.
function parseFile(file) {
  return babel.parseSync(readFileSync(file, 'utf8'), {
    filename: file, sourceType: 'module', configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] },
  });
}

// What a module exports: { names: Set, hasDefault, star } (`star` means "export * from", so any name may exist).
function exportsOf(ast) {
  const names = new Set();
  let hasDefault = false;
  let star = false;
  for (const node of ast.program.body) {
    if (node.type === 'ExportDefaultDeclaration') hasDefault = true;
    else if (node.type === 'ExportAllDeclaration') star = true;
    else if (node.type === 'ExportNamedDeclaration') {
      const d = node.declaration;
      if (d) {
        if (d.id) names.add(d.id.name);
        if (d.declarations) d.declarations.forEach(x => { if (x.id.type === 'Identifier') names.add(x.id.name); else collectPattern(x.id, names); });
      }
      (node.specifiers || []).forEach(s => {
        const name = s.exported.name || s.exported.value;
        if (name === 'default') hasDefault = true; else names.add(name);
      });
    }
  }
  return { names, hasDefault, star };
}
function collectPattern(p, names) {
  if (p.type === 'Identifier') names.add(p.name);
  else if (p.type === 'ObjectPattern') p.properties.forEach(x => collectPattern(x.value || x.argument, names));
  else if (p.type === 'ArrayPattern') p.elements.forEach(x => x && collectPattern(x, names));
  else if (p.type === 'AssignmentPattern') collectPattern(p.left, names);
  else if (p.type === 'RestElement') collectPattern(p.argument, names);
}

// The files a relative import can mean (React Native resolves platform files, so each one that exists is checked).
function candidates(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  const list = [base, `${base}.js`, `${base}.web.js`, `${base}.native.js`, `${base}.ios.js`, `${base}.android.js`,
    join(base, 'index.js'), join(base, 'index.web.js'), join(base, 'index.native.js')];
  return list.filter(p => existsSync(p) && statSync(p).isFile());
}

// -> an array of problems (empty when the tree is sound).
export function checkTree(root, files) {
  const problems = [];
  const cache = new Map();
  const info = f => {
    if (!cache.has(f)) cache.set(f, exportsOf(parseFile(f)));
    return cache.get(f);
  };
  for (const file of files) {
    const name = relative(root, file);
    let ast;
    try { ast = parseFile(file); } catch (e) { problems.push(`${name}: does not parse (${e.message})`); continue; }
    for (const node of ast.program.body) {
      if (node.type !== 'ImportDeclaration' || !/^\.\.?\//.test(node.source.value)) continue;
      const spec = node.source.value;
      if (/\.(png|jpe?g|gif|svg|ttf|otf|json|mp3|wav|css)$/i.test(spec)) continue;       // assets, not code
      const found = candidates(file, spec).filter(p => /\.js$/.test(p));
      if (!found.length) { problems.push(`${name}: cannot find '${spec}'`); continue; }
      for (const s of node.specifiers) {
        if (s.type === 'ImportNamespaceSpecifier') continue;
        const want = s.type === 'ImportDefaultSpecifier' ? 'default' : (s.imported.name || s.imported.value);
        for (const target of found) {
          const ex = info(target);
          if (ex.star) continue;
          const has = want === 'default' ? ex.hasDefault : ex.names.has(want);
          if (!has) problems.push(`${name}: '${want}' is imported from '${spec}' but ${relative(root, target)} does not export it`);
        }
      }
    }
  }
  return problems;
}

// ── the checker itself, on small made-up trees ───────────────────────────────────────────────

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'imports-'));
  for (const [name, text] of Object.entries(files)) {
    const p = join(root, name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
  }
  return { root, files: Object.keys(files).filter(f => f.endsWith('.js')).map(f => join(root, f)), done: () => rmSync(root, { recursive: true, force: true }) };
}

test('a sound tree has no problems: named, default and re-exported names, and an index file', () => {
  const t = fixture({
    'a.js': "import B, { one, two, three } from './b';\nimport { four } from './dir';\nimport * as all from './b';\nimport logo from './logo.png';\nexport const x = [B, one, two, three, four, all, logo];\n",
    'b.js': "export default function B() {}\nexport const one = 1;\nexport function two() {}\nconst c = 3;\nexport { c as three };\n",
    'dir/index.js': "export { four } from './deep';\n",
    'dir/deep.js': "export const four = 4;\n",
  });
  try { assert.deepEqual(checkTree(t.root, t.files), []); } finally { t.done(); }
});

test('an import of a name the module does not export is reported', () => {
  const t = fixture({ 'a.js': "import { gone } from './b';\nexport const x = gone;\n", 'b.js': 'export const here = 1;\n' });
  try { assert.deepEqual(checkTree(t.root, t.files), ["a.js: 'gone' is imported from './b' but b.js does not export it"]); } finally { t.done(); }
});

test('a default import from a module with no default export is reported', () => {
  const t = fixture({ 'a.js': "import B from './b';\nexport const x = B;\n", 'b.js': 'export const here = 1;\n' });
  try { assert.match(checkTree(t.root, t.files)[0], /'default' is imported from '\.\/b'/); } finally { t.done(); }
});

test('an import of a file that does not exist is reported', () => {
  const t = fixture({ 'a.js': "import { x } from './missing';\nexport const y = x;\n" });
  try { assert.deepEqual(checkTree(t.root, t.files), ["a.js: cannot find './missing'"]); } finally { t.done(); }
});

test('a file that does not parse is reported, and the rest are still checked', () => {
  const t = fixture({ 'a.js': 'export const x = (;\n', 'b.js': "import { nope } from './c';\nexport const y = nope;\n", 'c.js': 'export const here = 1;\n' });
  try {
    const out = checkTree(t.root, t.files);
    assert.equal(out.length, 2);
    assert.match(out.join('\n'), /a\.js: does not parse/);
    assert.match(out.join('\n'), /'nope' is imported/);
  } finally { t.done(); }
});

test('JSX, destructured exports and "export *" are understood', () => {
  const t = fixture({
    'a.js': "import { View, made } from './b';\nimport { anything } from './star';\nexport const x = <View a={made} b={anything} />;\n",
    'b.js': "export const { View, made } = { View: 1, made: 2 };\n",
    'star.js': "export * from './b';\n",
  });
  try { assert.deepEqual(checkTree(t.root, t.files), []); } finally { t.done(); }
});

test('a platform file (index.web.js next to index.js) is checked as well', () => {
  const t = fixture({
    'a.js': "import { shared, onlyNative } from './db';\nexport const x = [shared, onlyNative];\n",
    'db/index.js': 'export const shared = 1;\nexport const onlyNative = 2;\n',
    'db/index.web.js': 'export const shared = 1;\n',
  });
  try { assert.match(checkTree(t.root, t.files)[0], /'onlyNative' is imported from '\.\/db' but db\/index\.web\.js does not export it/); } finally { t.done(); }
});

// ── the real app ─────────────────────────────────────────────────────────────────────────────

test('every file in the app parses, and every relative import and imported name exists', () => {
  const files = [join(repo, 'App.js'), join(repo, 'index.js'), ...sourceFiles(join(repo, 'src'))].filter(f => existsSync(f));
  assert.ok(files.length > 10, 'found the app\'s source files');
  const problems = checkTree(repo, files);
  assert.deepEqual(problems, [], `\n  ${problems.join('\n  ')}`);
});
