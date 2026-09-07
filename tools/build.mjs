#!/usr/bin/env node
/* Build: one hashed, minified bundle.
   Reads index.html, finds the ordered <script defer src="js/…"> tags, concatenates
   those files in that order, minifies (whitespace + syntax ONLY — identifiers are
   never renamed: inline onclick="showView('x',this)" handlers and
   typeof fn==='function' checks rely on global names), hashes the result and
   writes dist/ with the 13 tags replaced by ONE <script defer src="/app.<hash>.js">.
   Source stays in js/ (the headless tests read index.html and js/*.js directly).
   Run from anywhere: node tools/build.mjs   (Node >= 18, no deps besides esbuild,
   and esbuild is optional — without it the bundle is plain concatenation). */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const rel = (p) => path.relative(ROOT, p) || '.';

// ── 1. index.html → ordered list of app scripts (CDN tags are left alone)
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const TAG_RE = /<script\s+defer\s+src="js\/([^"]+)"><\/script>\s*/g;
const tags = [...html.matchAll(TAG_RE)];
if (!tags.length) { console.error('build: no <script defer src="js/…"> tags found in index.html'); process.exit(1); }
const files = tags.map((m) => m[1]);
for (const f of files) {
  if (!fs.existsSync(path.join(ROOT, 'js', f))) { console.error('build: index.html references js/' + f + ' but it does not exist'); process.exit(1); }
}

// ── 2. concatenate in tag order (same separator the tests use)
const sources = files.map((f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'));
const concatenated = sources.join('\n;\n') + '\n';
const bytesBefore = Buffer.byteLength(concatenated);

// ── 3. minify (optional; the deploy must never fail because of the minifier)
let code = concatenated, minified = false;
try {
  const esbuild = await import('esbuild');
  const r = await esbuild.transform(concatenated, {
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false, // global names are part of the app's public surface
    target: 'es2018',
    legalComments: 'none',
    // format deliberately unset: plain classic script, one shared global scope
  });
  for (const w of r.warnings || []) console.warn('build: esbuild warning:', w.text);
  code = r.code;
  minified = true;
} catch (e) {
  const why = e && e.code === 'ERR_MODULE_NOT_FOUND' ? 'esbuild is not installed (npm install skipped?)' : (e && e.message) || String(e);
  console.warn('build: WARNING — minification skipped, shipping plain concatenation. ' + why);
}
if (!minified) code = concatenated;

// ── 4. hash → app.<hash>.js. The hash is of the code itself (not the banner), so
// an unchanged source rebuilt tomorrow yields the same filename and stays cached.
const hash = createHash('sha256').update(code).digest('hex').slice(0, 10);
const bundleName = `app.${hash}.js`;
// the banner goes on AFTER minification so legalComments:'none' cannot strip it
const banner = `/* Healthspan HQ ${hash} — built ${new Date().toISOString()} — ${files.length} modules: ${files.join(', ')} */\n`;
code = banner + code;

// ── 5. write dist/ (wipe first: idempotent)
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, bundleName), code);

// index.html: replace the block of app tags with one tag, at the position of the first
let replaced = false;
const outHtml = html.replace(TAG_RE, (m) => {
  if (replaced) return '';
  replaced = true;
  return `<script defer src="/${bundleName}"></script>\n`;
});
fs.writeFileSync(path.join(DIST, 'index.html'), outHtml);

// static assets: everything at the root the page (or the manifest) can reference
const ASSET_EXT = new Set(['.png', '.ico', '.svg', '.webmanifest', '.txt', '.xml']);
const SKIP_DIRS = new Set(['js', 'tools', 'netlify', 'node_modules', 'manuals', 'dist', '.git', '.netlify']);
const copied = [];
for (const ent of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (ent.isFile()) {
    const ext = path.extname(ent.name).toLowerCase();
    if (ASSET_EXT.has(ext) || /^favicon(\.|$)/i.test(ent.name)) {
      fs.copyFileSync(path.join(ROOT, ent.name), path.join(DIST, ent.name));
      copied.push(ent.name);
    }
  } else if (ent.isDirectory() && ent.name === 'fonts' && !SKIP_DIRS.has(ent.name)) {
    // plain mkdir + copyFileSync: cpSync trips over some mounted filesystems (EACCES on the dir)
    fs.mkdirSync(path.join(DIST, 'fonts'), { recursive: true });
    for (const f of fs.readdirSync(path.join(ROOT, 'fonts'))) if (/\.woff2?$/.test(f)) fs.copyFileSync(path.join(ROOT, 'fonts', f), path.join(DIST, 'fonts', f));
    copied.push('fonts/');
  }
}

// ── 6. summary
const bytesAfter = Buffer.byteLength(code);
const gz = zlib.gzipSync(code, { level: 9 }).length;
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log(
  `build: ${files.length} scripts → ${rel(path.join(DIST, bundleName))} · ${kb(bytesBefore)} → ${kb(bytesAfter)}` +
  ` (${minified ? 'minified' : 'NOT minified'}, gzip ${kb(gz)}) · hash ${hash} · +index.html +${copied.length} assets (${copied.join(', ')})`
);
