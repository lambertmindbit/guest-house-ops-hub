// Generates the PWA icons as PNGs with no image dependency: we draw a simple
// white "house" mark on a slate background into an RGBA buffer and encode a
// PNG by hand (zlib for IDAT, CRC32 for chunks). Re-run with: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const BG = [15, 23, 42]; // slate-900
const WHITE = [255, 255, 255];

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  // rows prefixed with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function drawIcon(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4);
  const S = size;
  const rr = 0.2 * S; // corner radius for the rounded (non-maskable) tile

  const inRounded = (x, y) => {
    const dx = Math.min(x - rr, 0) + Math.max(x - (S - rr), 0);
    const dy = Math.min(y - rr, 0) + Math.max(y - (S - rr), 0);
    return dx * dx + dy * dy <= rr * rr;
  };

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const bg = maskable ? true : inRounded(x + 0.5, y + 0.5);

      // House mark, centred, within the maskable safe zone.
      const cx = S / 2;
      const roof = y >= 0.28 * S && y <= 0.46 * S &&
        Math.abs(x - cx) <= 0.22 * S * ((y - 0.28 * S) / (0.18 * S));
      const body = x >= 0.34 * S && x <= 0.66 * S && y >= 0.46 * S && y <= 0.72 * S;
      const door = x >= 0.46 * S && x <= 0.54 * S && y >= 0.56 * S && y <= 0.72 * S;
      const white = (roof || body) && !door;

      const color = white ? WHITE : bg ? BG : null;
      if (color) {
        buf[i] = color[0];
        buf[i + 1] = color[1];
        buf[i + 2] = color[2];
        buf[i + 3] = 255;
      }
    }
  }
  return buf;
}

mkdirSync(new URL("../public/icons/", import.meta.url), { recursive: true });
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url);

const targets = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-512-maskable.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: true },
];

for (const t of targets) {
  writeFileSync(out(t.file), encodePng(t.size, drawIcon(t.size, { maskable: t.maskable })));
  console.log(`wrote public/icons/${t.file} (${t.size}px)`);
}
