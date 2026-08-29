// 零依赖生成各插件图标（渐变圆角方块 + 白色图形）
// 用法：node tools/gen-icons.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ICON_SIZES = [16, 48, 128];

// 各插件的图标配置：输出目录、渐变色、中心图形（ring 圆环 / dot 实心圆）
const EXTENSION_CONFIGS = [
  {
    dir: 'ai-reader-assistant/icons',
    colorFrom: [91, 94, 244],
    colorTo: [56, 189, 248],
    glyph: 'ring',
  },
  {
    dir: 'selection-explainer/icons',
    colorFrom: [168, 85, 247],
    colorTo: [236, 72, 153],
    glyph: 'dot',
  },
];

const CRC_TABLE = buildCrcTable();

function buildCrcTable() {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

// 逐像素绘制：圆角矩形内填充对角渐变，中心画白色图形
function drawPixel(x, y, size, config) {
  const radius = size * 0.22; // 圆角半径
  const cx = clampToCorner(x, size, radius);
  const cy = clampToCorner(y, size, radius);
  const cornerDist = Math.hypot(x - cx, y - cy);
  if (cornerDist > radius && (cx !== x || cy !== y) && isInCornerZone(x, y, size, radius)) {
    return [0, 0, 0, 0]; // 圆角外透明
  }

  // 对角渐变
  const t = (x + y) / (2 * size);
  const r = Math.round(config.colorFrom[0] + (config.colorTo[0] - config.colorFrom[0]) * t);
  const g = Math.round(config.colorFrom[1] + (config.colorTo[1] - config.colorFrom[1]) * t);
  const b = Math.round(config.colorFrom[2] + (config.colorTo[2] - config.colorFrom[2]) * t);

  // 中心白色图形
  const center = size / 2;
  const dist = Math.hypot(x - center + 0.5, y - center + 0.5);
  const isWhite =
    config.glyph === 'ring' ? dist <= size * 0.3 && dist >= size * 0.17 : dist <= size * 0.22;
  if (isWhite) {
    return [255, 255, 255, 255];
  }
  return [r, g, b, 255];
}

function clampToCorner(v, size, radius) {
  if (v < radius) {
    return radius;
  }
  if (v > size - radius) {
    return size - radius;
  }
  return v;
}

function isInCornerZone(x, y, size, radius) {
  const nearEdgeX = x < radius || x > size - radius;
  const nearEdgeY = y < radius || y > size - radius;
  return nearEdgeX && nearEdgeY;
}

function makePng(size, config) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = drawPixel(x, y, size, config);
      const offset = rowStart + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const config of EXTENSION_CONFIGS) {
  const outputDir = path.join(__dirname, '..', config.dir);
  fs.mkdirSync(outputDir, { recursive: true });
  for (const size of ICON_SIZES) {
    const file = path.join(outputDir, `icon${size}.png`);
    fs.writeFileSync(file, makePng(size, config));
    console.log(`generated ${file}`);
  }
}
