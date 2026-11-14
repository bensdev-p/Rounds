/**
 * Draws the Rounds app icon (the ladder mark, pager amber on scrub navy) and
 * writes it at the sizes phones and browsers need. No image libraries: shapes
 * are rendered with 4x4 supersampling and written as PNG with zlib.
 *
 *   node apps/mobile/scripts/make-icons.mjs
 *
 * Colours are the dark-theme `bg` and `signal` tokens from docs/design/tokens.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const tokens = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../docs/design/tokens.json', import.meta.url)), 'utf8'),
);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hex(tokens.color.dark.bg);
const MARK = hex(tokens.color.dark.signal);

// The ladder mark in a 0..1 square: two rails and three rungs, round caps.
// Same proportions as the 24-unit LadderIcon (rails at 7 and 17, rungs at 7.5, 12, 16.5).
const STROKE = 0.085;
const segments = [
  [0.34, 0.2, 0.34, 0.8],
  [0.66, 0.2, 0.66, 0.8],
  [0.34, 0.35, 0.66, 0.35],
  [0.34, 0.5, 0.66, 0.5],
  [0.34, 0.65, 0.66, 0.65],
];

function onMark(x, y) {
  for (const [x1, y1, x2, y2] of segments) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    const px = x1 + t * dx - x;
    const py = y1 + t * dy - y;
    if (px * px + py * py <= (STROKE / 2) ** 2) return true;
  }
  return false;
}

function render(size) {
  const SS = 4;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // PNG filter: none
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (onMark((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size)) hits++;
        }
      }
      const a = hits / (SS * SS);
      for (let c = 0; c < 3; c++) row[1 + x * 3 + c] = Math.round(BG[c] * (1 - a) + MARK[c] * a);
    }
    rows.push(row);
  }
  return png(size, Buffer.concat(rows));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = (rel) => fileURLToPath(new URL(rel, import.meta.url));
mkdirSync(out('../public/icons/'), { recursive: true });
const files = {
  '../public/icons/apple-touch-icon.png': 180,
  '../public/icons/icon-192.png': 192,
  '../public/icons/icon-512.png': 512,
  '../assets/favicon.png': 48,
  '../assets/icon.png': 1024,
};
for (const [rel, size] of Object.entries(files)) {
  writeFileSync(out(rel), render(size));
  console.log(`wrote ${rel.replace('../', 'apps/mobile/')} (${size}px)`);
}
