#!/usr/bin/env node
/**
 * Packages the extension into a zip file for Chrome Web Store submission.
 * Usage: node scripts/package.js
 * Output: dappscore-extension-<version>.zip
 *
 * Pure Node.js — no external dependencies.
 */

'use strict';
const fs      = require('node:fs');
const path    = require('node:path');
const zlib    = require('node:zlib');
const { execSync } = require('node:child_process');

const ROOT    = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const version  = manifest.version;
const outFile  = path.join(ROOT, `dappscore-extension-v${version}.zip`);

// Files/dirs to include
const INCLUDE = [
  'manifest.json',
  'popup.html',
  'src/content.js',
  'src/background.js',
  'src/content.css',
  'src/popup.js',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

// Verify icons exist; generate if not
const iconsExist = ['16','32','48','128'].every(
  s => fs.existsSync(path.join(ROOT, 'icons', `icon${s}.png`))
);
if (!iconsExist) {
  console.log('Icons missing — generating...');
  execSync('node ' + path.join(__dirname, 'generate-icons.js'), { stdio: 'inherit' });
}

// Check all files exist
const missing = INCLUDE.filter(f => !fs.existsSync(path.join(ROOT, f)));
if (missing.length > 0) {
  console.error('Missing files:\n' + missing.map(f => '  ' + f).join('\n'));
  process.exit(1);
}

// Build a minimal ZIP (stored, no compression for simplicity)
// We use zlib DEFLATE for actual file entries.
function dosDate(d) {
  return ((d.getFullYear() - 1980) << 9 | (d.getMonth() + 1) << 5 | d.getDate()) << 16 |
    (d.getHours() << 11 | d.getMinutes() << 5 | (d.getSeconds() >> 1));
}

function crc32(buf) {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const entries = [];
const parts   = [];
let offset = 0;
const now = dosDate(new Date());

for (const rel of INCLUDE) {
  const data = fs.readFileSync(path.join(ROOT, rel));
  const name = Buffer.from(rel);
  const crc  = crc32(data);
  const compressed = zlib.deflateRawSync(data);
  const useDeflate = compressed.length < data.length;
  const body = useDeflate ? compressed : data;

  const lh = Buffer.alloc(30 + name.length);
  lh.writeUInt32LE(0x04034b50, 0);  // local file header sig
  lh.writeUInt16LE(20, 4);          // version needed
  lh.writeUInt16LE(0, 6);           // flags
  lh.writeUInt16LE(useDeflate ? 8 : 0, 8);  // compression
  lh.writeUInt32LE(now, 10);        // mod time+date
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(body.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(name.length, 26);
  lh.writeUInt16LE(0, 28);
  name.copy(lh, 30);

  parts.push(lh, body);
  entries.push({ name, crc, compSize: body.length, uncompSize: data.length,
    method: useDeflate ? 8 : 0, offset, now });
  offset += lh.length + body.length;
}

// Central directory
const cdParts = [];
for (const e of entries) {
  const cd = Buffer.alloc(46 + e.name.length);
  cd.writeUInt32LE(0x02014b50, 0);  // central dir sig
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0, 8);
  cd.writeUInt16LE(e.method, 10);
  cd.writeUInt32LE(e.now, 12);
  cd.writeUInt32LE(e.crc, 16);
  cd.writeUInt32LE(e.compSize, 20);
  cd.writeUInt32LE(e.uncompSize, 24);
  cd.writeUInt16LE(e.name.length, 28);
  cd.writeUInt16LE(0, 30);  // extra
  cd.writeUInt16LE(0, 32);  // comment
  cd.writeUInt16LE(0, 34);  // disk start
  cd.writeUInt16LE(0, 36);  // internal attrs
  cd.writeUInt32LE(0, 38);  // external attrs
  cd.writeUInt32LE(e.offset, 42);
  e.name.copy(cd, 46);
  cdParts.push(cd);
}

const cdBuf  = Buffer.concat(cdParts);
const eocd   = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(entries.length, 8);
eocd.writeUInt16LE(entries.length, 10);
eocd.writeUInt32LE(cdBuf.length, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

fs.writeFileSync(outFile, Buffer.concat([...parts, cdBuf, eocd]));
console.log(`\nPackaged → ${path.basename(outFile)}  (${(fs.statSync(outFile).size / 1024).toFixed(1)} KB)`);
console.log('Ready to upload to the Chrome Web Store Developer Dashboard.');
