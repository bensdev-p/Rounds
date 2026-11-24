/**
 * Draws the PimpMe app icon (the raised hand, scrub navy on a pager-amber tile;
 * DESIGN.md → Brand) and writes it at the sizes phones and browsers need. No
 * image libraries: the hand's SVG path is flattened to line segments, rendered
 * with 4x4 supersampling and written as PNG with zlib.
 *
 *   node apps/mobile/scripts/make-icons.mjs
 *
 * Colours are the dark-theme `signal` and `onSignal` tokens from docs/design/tokens.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const tokens = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../docs/design/tokens.json', import.meta.url)), 'utf8'),
);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hex(tokens.color.dark.signal);
const MARK = hex(tokens.color.dark.onSignal);

// Lucide's `hand` (ISC licence), as drawn on the brand board (site/index.html):
// a 24-unit box, stroke 2.2, round caps and joins, 104 px on a 168 px tile.
const HAND = [
  'M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2',
  'M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2',
  'M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8',
  'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
];
const BOX = 104 / 168; // share of the tile the 24-unit box covers
const STROKE = (2.2 / 24) * BOX;

/** Flattens an SVG path (M L H V C A, either case) into line segments. */
function flatten(d) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g);
  const segs = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  const num = () => parseFloat(tokens[i++]);
  const line = (nx, ny) => {
    segs.push([x, y, nx, ny]);
    x = nx;
    y = ny;
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M':
        x = ox + num();
        y = oy + num();
        cmd = rel ? 'l' : 'L';
        break;
      case 'L': {
        const nx = ox + num();
        line(nx, oy + num());
        break;
      }
      case 'H':
        line(ox + num(), y);
        break;
      case 'V':
        line(x, oy + num());
        break;
      case 'C': {
        const p = [x, y, ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()];
        for (let k = 1; k <= 16; k++) {
          const t = k / 16;
          const u = 1 - t;
          const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
          line(
            b[0] * p[0] + b[1] * p[2] + b[2] * p[4] + b[3] * p[6],
            b[0] * p[1] + b[1] * p[3] + b[2] * p[5] + b[3] * p[7],
          );
        }
        break;
      }
      case 'A': {
        // Circular arcs only (rx = ry, no rotation), which is all the hand uses.
        const r = num();
        num();
        num();
        const large = num();
        const sweep = num();
        const nx = ox + num();
        const ny = oy + num();
        const mx = (x - nx) / 2;
        const my = (y - ny) / 2;
        const rr = Math.max(r, Math.hypot(mx, my));
        const h = Math.sqrt(Math.max(0, rr * rr - mx * mx - my * my)) / Math.hypot(mx, my);
        const s = large !== sweep ? 1 : -1;
        const cx = (x + nx) / 2 + s * h * my;
        const cy = (y + ny) / 2 - s * h * mx;
        const a0 = Math.atan2(y - cy, x - cx);
        let da = Math.atan2(ny - cy, nx - cx) - a0;
        if (sweep && da < 0) da += 2 * Math.PI;
        if (!sweep && da > 0) da -= 2 * Math.PI;
        for (let k = 1; k <= 24; k++) {
          const a = a0 + (da * k) / 24;
          line(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
        }
        x = nx;
        y = ny;
        break;
      }
      default:
        throw new Error(`make-icons: unsupported path command ${cmd}`);
    }
  }
  return segs;
}

// Segments in a 0..1 square, the 24-unit box centred on the tile.
const segments = HAND.flatMap(flatten).map((seg) => seg.map((v) => (1 - BOX) / 2 + (v / 24) * BOX));

function onMark(x, y) {
  for (const [x1, y1, x2, y2] of segments) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len));
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
