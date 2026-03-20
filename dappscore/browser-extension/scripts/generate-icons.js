#!/usr/bin/env node
/**
 * Generates icons/icon{16,32,48,128}.png
 * Pure Node.js — no external dependencies required.
 * Uses zlib (built-in) for DEFLATE compression and a hand-rolled CRC32.
 *
 * Icon design: yellow circle (#FACC15) on slate background (#1E293B),
 * with a simple shield silhouette cut from the circle.
 */

'use strict';
const zlib = require('node:zlib');
const fs   = require('node:fs');
const path = require('node:path');

// ── CRC32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── PNG chunk builder ──────────────────────────────────────────────────────
function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

// ── Icon pixel renderer ────────────────────────────────────────────────────
// Draws a yellow (#FACC15) filled circle on a dark (#1E293B) background,
// with a simple shield shape (inverted pentagon) cut out in white.

const BG = [0x1e, 0x29, 0x3b, 0xff];   // #1E293B
const FG = [0xfa, 0xcc, 0x15, 0xff];   // #FACC15 (yellow)
const WH = [0xff, 0xff, 0xff, 0xff];   // shield highlight

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function renderPixel(x, y, size) {
  // Normalise to [-1, 1]
  const nx = (x + 0.5) / size * 2 - 1;
  const ny = (y + 0.5) / size * 2 - 1;

  // Outer circle radius: 0.85 of half-size
  const r2 = nx * nx + ny * ny;
  if (r2 > 0.85 * 0.85) return BG;

  // Shield silhouette (simple "house" / shield shape in normalised coords):
  // The shield is a rounded rectangle with a pointed bottom.
  //   top:    ny > -0.55
  //   sides:  |nx| < 0.45
  //   bottom: the pointed part: |nx| < (ny + 0.55) * 0.55 when ny < -0.1
  const shieldTop   =  0.60;
  const shieldSideX =  0.42;

  const inRect = ny < shieldTop && Math.abs(nx) < shieldSideX;

  // Triangle for the point at the bottom
  const tipDepth = 0.65;  // how far down the tip goes
  const inTip    = ny >= shieldTop - tipDepth && Math.abs(nx) < (shieldTop - ny) * 0.65;

  const inShield = inRect || inTip;

  if (!inShield) return FG;

  // Inner shield is white at the very centre, fades to semi-transparent
  // for a simple "gloss" feel — keeps it readable at 16px
  const dist = Math.sqrt(nx * nx + ny * ny);
  if (dist < 0.20) return WH;

  return FG;
}

function buildIconPNG(size) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filter
  ihdr[12] = 0; // no interlace

  // Raw scanlines: each row = 1 filter byte + size*4 RGBA bytes
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = renderPixel(x, y, size);
      const off = y * (1 + size * 4) + 1 + x * 4;
      raw[off]     = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Write icons ────────────────────────────────────────────────────────────
const outDir = path.resolve(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const png  = buildIconPNG(size);
  const file = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`  ✓ icons/icon${size}.png  (${png.length} bytes)`);
}

console.log('\nIcons generated in browser-extension/icons/');
