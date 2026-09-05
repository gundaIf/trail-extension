// Generates the Trail logo, a hand-drawn spiral trail, as PNG toolbar icons
// and an SVG. No external dependencies (pure Node + zlib).
// Run: node generate-icons.js  →  writes icons/icon{16,32,48,128}.png and icons/logo.svg
//                                  and prints the SVG path `d` for inline use.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const INK = [0xc4, 0x63, 0x3f]; // terracotta

// ---- the spiral ------------------------------------------------------------
// Archimedean spiral from the centre outward, with smooth low-frequency wobble
// so it reads as drawn by hand rather than plotted. Deterministic (no RNG).
// Returns points in a unit frame centred on (0,0), normalised so max radius = 1.
function spiralPoints() {
  const turns = 2.25;
  const thetaMax = turns * Math.PI * 2;
  const step = 0.05;
  const pts = [];
  let maxR = 0;
  for (let th = 0; th <= thetaMax + 1e-6; th += step) {
    const t = th / thetaMax;                       // 0..1 along the spiral
    let r = 0.10 + 0.90 * t;                        // grows outward
    r += 0.030 * Math.sin(3 * th + 0.6)            // hand-drawn wobble
       + 0.017 * Math.sin(6.3 * th + 2.4);
    let x = r * Math.cos(th) + 0.020 * Math.sin(5 * th + 1.1);
    let y = r * Math.sin(th) + 0.020 * Math.cos(4 * th + 0.3);
    pts.push({ x, y, t });
    maxR = Math.max(maxR, Math.hypot(x, y));
  }
  for (const p of pts) { p.x /= maxR; p.y /= maxR; } // normalise into unit circle
  return pts;
}
const PTS = spiralPoints();

// stroke half-width along the spiral (unit frame): thin at the start, fuller at
// the outer end, a pen-pressure taper. Plus a rounded "head" dot at the tip.
const W0 = 0.055, W1 = 0.11;
function halfWidthAt(t) { return W0 + (W1 - W0) * t; }

// ---- PNG raster ------------------------------------------------------------
function render(size) {
  const pad = size * 0.16;
  const scale = (size / 2 - pad);
  const cx = size / 2, cy = size / 2;
  const P = PTS.map((p) => ({ x: cx + p.x * scale, y: cy + p.y * scale, t: p.t }));
  const strokeScale = scale;
  const headR = 0.15 * scale;                    // the trail-head dot
  const head = P[P.length - 1];

  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      let cov = 0;
      // coverage from the tapered stroke (min signed distance across segments)
      for (let i = 1; i < P.length; i++) {
        const a = P[i - 1], b = P[i];
        const d = segDist(px, py, a, b);
        const r = halfWidthAt((a.t + b.t) / 2) * strokeScale;
        cov = Math.max(cov, smooth(r + 0.6, r - 0.6, d.dist));
        if (cov >= 1) break;
      }
      // rounded head dot
      const hd = Math.hypot(px - head.x, py - head.y);
      cov = Math.max(cov, smooth(headR + 0.6, headR - 0.6, hd));

      const i = (y * size + x) * 4;
      buf[i] = INK[0]; buf[i + 1] = INK[1]; buf[i + 2] = INK[2];
      buf[i + 3] = Math.round(clamp01(cov) * 255);
    }
  }
  return encodePNG(buf, size, size);
}

function segDist(px, py, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const wx = px - a.x, wy = py - a.y;
  const len2 = vx * vx + vy * vy || 1e-9;
  let t = (wx * vx + wy * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cxp = a.x + t * vx, cyp = a.y + t * vy;
  return { dist: Math.hypot(px - cxp, py - cyp) };
}
function smooth(edge0, edge1, x) { // 1 inside (x<edge1), 0 outside (x>edge0)
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// ---- SVG -------------------------------------------------------------------
// A 24×24 spiral. Constant-width round-capped stroke + a head dot; the wobble
// supplies the hand-drawn character.
function buildSVG() {
  const S = 24, pad = 3.5, scale = S / 2 - pad, c = S / 2;
  const map = (p) => [ (c + p.x * scale).toFixed(2), (c + p.y * scale).toFixed(2) ];
  let d = '';
  PTS.forEach((p, i) => {
    const [x, y] = map(p);
    d += (i === 0 ? `M${x} ${y}` : ` L${x} ${y}`);
  });
  const head = map(PTS[PTS.length - 1]);
  const svg =
`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="${d}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${head[0]}" cy="${head[1]}" r="1.5" fill="currentColor"/>
</svg>`;
  return { svg, d, head };
}

// ---- minimal PNG encoder ---------------------------------------------------
function encodePNG(rgba, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}
let CRC_TABLE;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

// ---- run -------------------------------------------------------------------
[16, 32, 48, 128].forEach((size) => {
  const out = path.join(__dirname, 'icons', `icon${size}.png`);
  fs.writeFileSync(out, render(size));
  console.log('wrote', out);
});
const { svg, d } = buildSVG();
fs.writeFileSync(path.join(__dirname, 'icons', 'logo.svg'), svg);
console.log('wrote icons/logo.svg');
console.log('\nInline path d:\n' + d);
