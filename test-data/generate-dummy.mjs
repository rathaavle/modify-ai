/**
 * Dummy data generator untuk Medify AI testing
 * Jalankan: node test-data/generate-dummy.mjs
 *
 * Output:
 *   test-data/scenario-valid/label.png       — label kemasan (data cocok)
 *   test-data/scenario-valid/document.pdf    — dokumen pendukung (data cocok)
 *   test-data/scenario-mismatch/label.png    — label kemasan (batch number beda)
 *   test-data/scenario-mismatch/document.pdf — dokumen pendukung (batch number beda)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Minimal PNG Generator ───────────────────────────────────────────────────
// Generates a simple white PNG with black text rendered as pixel blocks.
// Uses only Node.js built-ins (zlib for deflate, no canvas needed).

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

// 5x7 pixel font for ASCII chars 32-127
const FONT = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x09, 0x09, 0x09, 0x09, 0x09, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x11, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  0: [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  1: [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  2: [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  3: [0x1f, 0x02, 0x04, 0x06, 0x01, 0x11, 0x0e],
  4: [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  5: [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  6: [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  7: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  8: [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  9: [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  "-": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04],
  ":": [0x00, 0x04, 0x00, 0x00, 0x00, 0x04, 0x00],
  a: [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  b: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x1e],
  c: [0x00, 0x00, 0x0e, 0x10, 0x10, 0x11, 0x0e],
  d: [0x01, 0x01, 0x0f, 0x11, 0x11, 0x11, 0x0f],
  e: [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  f: [0x06, 0x09, 0x08, 0x1c, 0x08, 0x08, 0x08],
  g: [0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  h: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x11],
  i: [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  j: [0x02, 0x00, 0x06, 0x02, 0x02, 0x12, 0x0c],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0x00, 0x00, 0x1a, 0x15, 0x15, 0x11, 0x11],
  n: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x11, 0x11],
  o: [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  p: [0x00, 0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10],
  q: [0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x01],
  r: [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10],
  s: [0x00, 0x00, 0x0e, 0x10, 0x0e, 0x01, 0x1e],
  t: [0x08, 0x08, 0x1c, 0x08, 0x08, 0x09, 0x06],
  u: [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0d],
  v: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04],
  w: [0x00, 0x00, 0x11, 0x11, 0x15, 0x15, 0x0a],
  x: [0x00, 0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11],
  y: [0x00, 0x11, 0x11, 0x0f, 0x01, 0x11, 0x0e],
  z: [0x00, 0x00, 0x1f, 0x02, 0x04, 0x08, 0x1f],
};

function getGlyph(ch) {
  return FONT[ch] || FONT[" "];
}

/**
 * Generate a PNG image with text lines.
 * @param {string[]} lines - Array of text lines to render
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @returns {Buffer} PNG file buffer
 */
function generatePNG(lines, width = 400, height = 300) {
  const SCALE = 3; // pixel scale for each font pixel
  const CHAR_W = 5 * SCALE + SCALE; // char width + spacing
  const CHAR_H = 7 * SCALE + SCALE * 2; // char height + line spacing
  const MARGIN_X = 20;
  const MARGIN_Y = 20;

  // RGBA pixel buffer (white background)
  const pixels = new Uint8Array(width * height * 4).fill(255);

  function setPixel(x, y, r, g, b) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = 255;
  }

  function drawChar(ch, cx, cy, r = 0, g = 0, b = 0) {
    const glyph = getGlyph(ch);
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row];
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) {
          for (let sy = 0; sy < SCALE; sy++) {
            for (let sx = 0; sx < SCALE; sx++) {
              setPixel(cx + col * SCALE + sx, cy + row * SCALE + sy, r, g, b);
            }
          }
        }
      }
    }
  }

  function drawText(text, x, y, r = 0, g = 0, b = 0) {
    let cx = x;
    for (const ch of text) {
      drawChar(ch, cx, y, r, g, b);
      cx += CHAR_W;
    }
  }

  // Draw a border rectangle
  for (let x = 0; x < width; x++) {
    setPixel(x, 0, 180, 180, 180);
    setPixel(x, height - 1, 180, 180, 180);
  }
  for (let y = 0; y < height; y++) {
    setPixel(0, y, 180, 180, 180);
    setPixel(width - 1, y, 180, 180, 180);
  }

  // Draw lines
  lines.forEach((line, i) => {
    const isHeader = i === 0;
    const y = MARGIN_Y + i * CHAR_H;
    if (isHeader) {
      // Draw header background
      for (let px = 2; px < width - 2; px++) {
        for (let py = y - 4; py < y + CHAR_H - 2; py++) {
          setPixel(px, py, 30, 80, 160);
        }
      }
      drawText(line, MARGIN_X, y, 255, 255, 255);
    } else {
      drawText(line, MARGIN_X, y);
    }
  });

  // Build PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB (we'll use RGBA but write as RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Build raw image data (filter byte 0 per row + RGB pixels)
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    rawData[y * rowSize] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * rowSize + 1 + x * 3;
      rawData[dstIdx] = pixels[srcIdx];
      rawData[dstIdx + 1] = pixels[srcIdx + 1];
      rawData[dstIdx + 2] = pixels[srcIdx + 2];
    }
  }

  // Update IHDR for RGB (not RGBA)
  ihdr[9] = 2;

  const compressed = zlib.deflateSync(rawData, { level: 6 });

  const png = Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);

  return png;
}

// ─── Minimal PDF Generator ───────────────────────────────────────────────────
// Generates a valid PDF 1.4 with text content. No external deps.

function generatePDF(title, lines) {
  const textContent = lines
    .map((l) => `BT /F1 12 Tf ${l.x} ${l.y} Td (${escapePDF(l.text)}) Tj ET`)
    .join("\n");

  const pageContent = textContent;
  const contentStream = pageContent;
  const streamLen = Buffer.byteLength(contentStream, "latin1");

  let pdf = "";
  const offsets = [];

  pdf += "%PDF-1.4\n";
  pdf += "%\xE2\xE3\xCF\xD3\n"; // binary comment

  // Object 1: Catalog
  offsets[1] = pdf.length;
  pdf += "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";

  // Object 2: Pages
  offsets[2] = pdf.length;
  pdf += "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";

  // Object 3: Page
  offsets[3] = pdf.length;
  pdf +=
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]\n" +
    "   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";

  // Object 4: Content stream
  offsets[4] = pdf.length;
  pdf += `4 0 obj\n<< /Length ${streamLen} >>\nstream\n`;
  pdf += contentStream;
  pdf += "\nendstream\nendobj\n";

  // Object 5: Font
  offsets[5] = pdf.length;
  pdf +=
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

  // Cross-reference table
  const xrefOffset = pdf.length;
  pdf += "xref\n";
  pdf += `0 6\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }

  pdf += "trailer\n<< /Size 6 /Root 1 0 R >>\n";
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

function escapePDF(str) {
  return str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// ─── Scenario Data ───────────────────────────────────────────────────────────

const scenarios = {
  valid: {
    label: {
      materialName: "Paracetamol 500mg",
      batchNumber: "BT-2024-001",
      expiryDate: "01/2026",
    },
    document: {
      materialName: "Paracetamol 500mg",
      batchNumber: "BT-2024-001",
      expiryDate: "January 2026",
    },
  },
  mismatch: {
    label: {
      materialName: "Amoxicillin 250mg",
      batchNumber: "AMX-2024-055",
      expiryDate: "06/2025",
    },
    document: {
      materialName: "Amoxicillin 250mg",
      batchNumber: "AMX-2024-099", // <-- BEDA (value_mismatch → HIGH risk)
      expiryDate: "June 2025",
    },
  },
};

// ─── Generate Files ──────────────────────────────────────────────────────────

for (const [scenarioName, data] of Object.entries(scenarios)) {
  const dir = path.join(__dirname, `scenario-${scenarioName}`);
  ensureDir(dir);

  const { label, document: doc } = data;

  // --- Label PNG ---
  const labelLines = [
    "  LABEL KEMASAN FARMASI  ",
    `Product: ${label.materialName}`,
    `Batch No: ${label.batchNumber}`,
    `Exp Date: ${label.expiryDate}`,
    `Mfg: PT Farma Indonesia`,
    `Reg No: DBL2024001234A1`,
    `Store below 25C`,
    `Keep out of reach of children`,
  ];

  const labelPNG = generatePNG(labelLines, 500, 280);
  fs.writeFileSync(path.join(dir, "label.png"), labelPNG);
  console.log(`✓ ${scenarioName}/label.png`);

  // --- Document PDF ---
  const pdfLines = [
    { x: 50, y: 780, text: "CERTIFICATE OF ANALYSIS" },
    { x: 50, y: 760, text: "PT Farma Indonesia - Quality Control Dept" },
    { x: 50, y: 730, text: "-------------------------------------------" },
    { x: 50, y: 710, text: `Product Name : ${doc.materialName}` },
    { x: 50, y: 690, text: `Batch Number : ${doc.batchNumber}` },
    { x: 50, y: 670, text: `Expiry Date  : ${doc.expiryDate}` },
    { x: 50, y: 650, text: `Manufacture  : PT Farma Indonesia` },
    { x: 50, y: 630, text: `Reg Number   : DBL2024001234A1` },
    { x: 50, y: 600, text: "-------------------------------------------" },
    { x: 50, y: 580, text: "TEST RESULTS:" },
    { x: 50, y: 560, text: "Appearance   : White crystalline powder - PASS" },
    { x: 50, y: 540, text: "Assay        : 99.8% - PASS" },
    { x: 50, y: 520, text: "Dissolution  : 98.5% - PASS" },
    { x: 50, y: 500, text: "Microbial    : Complies - PASS" },
    { x: 50, y: 470, text: "-------------------------------------------" },
    { x: 50, y: 450, text: "CONCLUSION: APPROVED FOR RELEASE" },
    { x: 50, y: 420, text: "QC Manager: Dr. Siti Rahayu" },
    { x: 50, y: 400, text: "Date: 15 January 2024" },
  ];

  const docPDF = generatePDF("Certificate of Analysis", pdfLines);
  fs.writeFileSync(path.join(dir, "document.pdf"), docPDF);
  console.log(`✓ ${scenarioName}/document.pdf`);
}

console.log("\nDone! Files generated in test-data/");
console.log("\nSkenario:");
console.log(
  "  scenario-valid/    → semua field cocok (status: VALID, risk: LOW)",
);
console.log(
  "  scenario-mismatch/ → batch number beda (status: MISMATCH, risk: HIGH)",
);
