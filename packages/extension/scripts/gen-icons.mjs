// Generates simple branded PNG icons with no external deps.
// Design: indigo rounded square with a black "redaction" bar across the middle.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// colors (RGBA)
const BG = [79, 70, 229, 255];      // indigo-600
const BAR = [17, 24, 39, 255];      // near-black redaction bar
const TRANSPARENT = [0, 0, 0, 0];

function makePixels(size) {
  const px = new Uint8Array(size * size * 4);
  const r = Math.round(size * 0.18); // corner radius
  const barTop = Math.round(size * 0.42);
  const barBot = Math.round(size * 0.58);
  const barL = Math.round(size * 0.2);
  const barR = Math.round(size * 0.8);

  const inRounded = (x, y) => {
    // rounded-rect mask
    const minX = r, maxX = size - 1 - r;
    const minY = r, maxY = size - 1 - r;
    let cx = x, cy = y;
    if (x < minX) cx = minX; else if (x > maxX) cx = maxX;
    if (y < minY) cy = minY; else if (y > maxY) cy = maxY;
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let c = TRANSPARENT;
      if (inRounded(x, y)) {
        c = BG;
        if (y >= barTop && y <= barBot && x >= barL && x <= barR) c = BAR;
      }
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
    }
  }
  return px;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makePng(size) {
  const px = makePixels(size);
  // add filter byte (0) at the start of each scanline
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 48, 128]) {
  const out = join(outDir, `icon${size}.png`);
  writeFileSync(out, makePng(size));
  console.log('wrote', out);
}
