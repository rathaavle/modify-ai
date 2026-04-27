/**
 * Dummy data generator untuk Medify AI testing
 * Jalankan: node test-data/generate-dummy.mjs
 *
 * Output (per skenario): label.png + document.pdf
 *
 * ── VALID (ekspektasi: VALID, RISIKO RENDAH) ──────────────────────────────
 *  scenario-valid-01  Semua field identik persis
 *  scenario-valid-02  Expiry date format berbeda (MM/YYYY vs Month YYYY)
 *  scenario-valid-03  Expiry date format YYYY-MM vs MM/YYYY
 *  scenario-valid-04  Nama material case berbeda (uppercase vs titlecase)
 *  scenario-valid-05  Produk antibiotik, semua cocok
 *
 * ── MISMATCH (ekspektasi: MISMATCH / SUSPICIOUS, RISIKO TINGGI/SEDANG) ───
 *  scenario-mismatch-01  Batch number beda (HIGH risk)
 *  scenario-mismatch-02  Nama material beda — beda produk (HIGH risk)
 *  scenario-mismatch-03  Batch number DAN nama material beda (HIGH risk)
 *  scenario-mismatch-04  Expiry date beda bulan (MISMATCH)
 *  scenario-mismatch-05  Expiry date beda tahun (MISMATCH)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Minimal PNG Generator ────────────────────────────────────────────────────

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
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  ".": [0, 0, 0, 0, 0, 0, 0x04],
  ":": [0, 0x04, 0, 0, 0, 0x04, 0],
  a: [0, 0, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  b: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x1e],
  c: [0, 0, 0x0e, 0x10, 0x10, 0x11, 0x0e],
  d: [0x01, 0x01, 0x0f, 0x11, 0x11, 0x11, 0x0f],
  e: [0, 0, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  f: [0x06, 0x09, 0x08, 0x1c, 0x08, 0x08, 0x08],
  g: [0, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  h: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x11],
  i: [0x04, 0, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  j: [0x02, 0, 0x06, 0x02, 0x02, 0x12, 0x0c],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0, 0, 0x1a, 0x15, 0x15, 0x11, 0x11],
  n: [0, 0, 0x1e, 0x11, 0x11, 0x11, 0x11],
  o: [0, 0, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  p: [0, 0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10],
  q: [0, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x01],
  r: [0, 0, 0x16, 0x19, 0x10, 0x10, 0x10],
  s: [0, 0, 0x0e, 0x10, 0x0e, 0x01, 0x1e],
  t: [0x08, 0x08, 0x1c, 0x08, 0x08, 0x09, 0x06],
  u: [0, 0, 0x11, 0x11, 0x11, 0x13, 0x0d],
  v: [0, 0, 0x11, 0x11, 0x11, 0x0a, 0x04],
  w: [0, 0, 0x11, 0x11, 0x15, 0x15, 0x0a],
  x: [0, 0, 0x11, 0x0a, 0x04, 0x0a, 0x11],
  y: [0, 0x11, 0x11, 0x0f, 0x01, 0x11, 0x0e],
  z: [0, 0, 0x1f, 0x02, 0x04, 0x08, 0x1f],
};

function getGlyph(ch) {
  return FONT[ch] || FONT[" "];
}

function generatePNG(
  lines,
  width = 520,
  height = 300,
  headerColor = [30, 80, 160],
) {
  const SCALE = 3;
  const CHAR_W = 5 * SCALE + SCALE;
  const CHAR_H = 7 * SCALE + SCALE * 2;
  const MARGIN_X = 20;
  const MARGIN_Y = 20;

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
          for (let sy = 0; sy < SCALE; sy++)
            for (let sx = 0; sx < SCALE; sx++)
              setPixel(cx + col * SCALE + sx, cy + row * SCALE + sy, r, g, b);
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

  // Border
  for (let x = 0; x < width; x++) {
    setPixel(x, 0, 180, 180, 180);
    setPixel(x, height - 1, 180, 180, 180);
  }
  for (let y = 0; y < height; y++) {
    setPixel(0, y, 180, 180, 180);
    setPixel(width - 1, y, 180, 180, 180);
  }

  lines.forEach((line, i) => {
    const y = MARGIN_Y + i * CHAR_H;
    if (i === 0) {
      for (let px = 2; px < width - 2; px++)
        for (let py = y - 4; py < y + CHAR_H - 2; py++)
          setPixel(px, py, ...headerColor);
      drawText(line, MARGIN_X, y, 255, 255, 255);
    } else {
      drawText(line, MARGIN_X, y);
    }
  });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    rawData[y * rowSize] = 0;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4,
        d = y * rowSize + 1 + x * 3;
      rawData[d] = pixels[s];
      rawData[d + 1] = pixels[s + 1];
      rawData[d + 2] = pixels[s + 2];
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 6 });
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Minimal PDF Generator ────────────────────────────────────────────────────

function escapePDF(str) {
  return str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function generatePDF(lines) {
  const contentStream = lines
    .map((l) => `BT /F1 12 Tf ${l.x} ${l.y} Td (${escapePDF(l.text)}) Tj ET`)
    .join("\n");
  const streamLen = Buffer.byteLength(contentStream, "latin1");

  let pdf = "";
  const offsets = [];
  pdf += "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  offsets[1] = pdf.length;
  pdf += "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  offsets[2] = pdf.length;
  pdf += "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  offsets[3] = pdf.length;
  pdf +=
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]\n   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";
  offsets[4] = pdf.length;
  pdf += `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${contentStream}\nendstream\nendobj\n`;
  offsets[5] = pdf.length;
  pdf +=
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";
  const xrefOffset = pdf.length;
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++)
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

// ─── File builders ────────────────────────────────────────────────────────────

function makeLabelPNG(data, headerColor) {
  return generatePNG(
    [
      "  LABEL KEMASAN FARMASI  ",
      `Product: ${data.materialName}`,
      `Batch No: ${data.batchNumber}`,
      `Exp Date: ${data.expiryDate}`,
      `Mfg: ${data.manufacturer || "PT Farma Indonesia"}`,
      `Reg No: ${data.regNo || "DBL2024001234A1"}`,
      `Store below 25C`,
      `Keep out of reach of children`,
    ],
    520,
    290,
    headerColor,
  );
}

function makeDocumentPDF(data) {
  return generatePDF([
    { x: 50, y: 780, text: data.docType || "CERTIFICATE OF ANALYSIS" },
    {
      x: 50,
      y: 760,
      text: `${data.manufacturer || "PT Farma Indonesia"} - Quality Control Dept`,
    },
    { x: 50, y: 730, text: "-------------------------------------------" },
    { x: 50, y: 710, text: `Product Name : ${data.materialName}` },
    { x: 50, y: 690, text: `Batch Number : ${data.batchNumber}` },
    { x: 50, y: 670, text: `Expiry Date  : ${data.expiryDate}` },
    {
      x: 50,
      y: 650,
      text: `Manufacture  : ${data.manufacturer || "PT Farma Indonesia"}`,
    },
    {
      x: 50,
      y: 630,
      text: `Reg Number   : ${data.regNo || "DBL2024001234A1"}`,
    },
    { x: 50, y: 600, text: "-------------------------------------------" },
    { x: 50, y: 580, text: "TEST RESULTS:" },
    {
      x: 50,
      y: 560,
      text: `Appearance   : ${data.appearance || "White crystalline powder"} - PASS`,
    },
    { x: 50, y: 540, text: `Assay        : ${data.assay || "99.8%"} - PASS` },
    { x: 50, y: 520, text: "Dissolution  : 98.5% - PASS" },
    { x: 50, y: 500, text: "Microbial    : Complies - PASS" },
    { x: 50, y: 470, text: "-------------------------------------------" },
    { x: 50, y: 450, text: "CONCLUSION: APPROVED FOR RELEASE" },
    {
      x: 50,
      y: 420,
      text: `QC Manager: ${data.qcManager || "Dr. Siti Rahayu"}`,
    },
    { x: 50, y: 400, text: `Date: ${data.releaseDate || "15 January 2024"}` },
  ]);
}

// ─── Scenario Definitions ─────────────────────────────────────────────────────

const scenarios = [
  // ══════════════════════════════════════════════════════════════════════════
  // VALID — ekspektasi: VALID, RISIKO RENDAH
  // ══════════════════════════════════════════════════════════════════════════

  {
    dir: "scenario-valid-01",
    desc: "Semua field identik persis",
    expected: "VALID | LOW",
    label: {
      materialName: "Paracetamol 500mg",
      batchNumber: "BT-2024-001",
      expiryDate: "01/2026",
    },
    document: {
      materialName: "Paracetamol 500mg",
      batchNumber: "BT-2024-001",
      expiryDate: "01/2026",
    },
  },

  {
    dir: "scenario-valid-02",
    desc: "Expiry date: MM/YYYY vs Month YYYY",
    expected: "VALID | LOW",
    label: {
      materialName: "Ibuprofen 400mg",
      batchNumber: "IBU-2024-088",
      expiryDate: "03/2027",
    },
    document: {
      materialName: "Ibuprofen 400mg",
      batchNumber: "IBU-2024-088",
      expiryDate: "March 2027",
    },
  },

  {
    dir: "scenario-valid-03",
    desc: "Expiry date: YYYY-MM vs MM/YYYY",
    expected: "VALID | LOW",
    label: {
      materialName: "Metformin 500mg",
      batchNumber: "MET-2023-412",
      expiryDate: "09/2025",
    },
    document: {
      materialName: "Metformin 500mg",
      batchNumber: "MET-2023-412",
      expiryDate: "2025-09",
      docType: "PACKING LIST",
      qcManager: "Dr. Budi Santoso",
    },
  },

  {
    dir: "scenario-valid-04",
    desc: "Nama material case berbeda (uppercase vs titlecase)",
    expected: "VALID | LOW",
    label: {
      materialName: "AMOXICILLIN 500MG",
      batchNumber: "AMX-2024-200",
      expiryDate: "12/2026",
    },
    document: {
      materialName: "Amoxicillin 500mg",
      batchNumber: "AMX-2024-200",
      expiryDate: "December 2026",
      manufacturer: "PT Kimia Farma",
      qcManager: "Dr. Rina Wati",
    },
  },

  {
    dir: "scenario-valid-05",
    desc: "Produk antibiotik, semua field cocok",
    expected: "VALID | LOW",
    label: {
      materialName: "Ciprofloxacin 500mg",
      batchNumber: "CIP-2024-777",
      expiryDate: "Jun 2026",
      manufacturer: "PT Bio Farma",
      regNo: "GKL2024005678B1",
    },
    document: {
      materialName: "Ciprofloxacin 500mg",
      batchNumber: "CIP-2024-777",
      expiryDate: "June 2026",
      manufacturer: "PT Bio Farma",
      regNo: "GKL2024005678B1",
      docType: "CERTIFICATE OF ANALYSIS",
      qcManager: "Dr. Ahmad Fauzi",
      releaseDate: "10 June 2024",
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MISMATCH — ekspektasi: MISMATCH, RISIKO TINGGI/SEDANG
  // ══════════════════════════════════════════════════════════════════════════

  {
    dir: "scenario-mismatch-01",
    desc: "Batch number beda → HIGH risk",
    expected: "MISMATCH | HIGH",
    label: {
      materialName: "Amoxicillin 250mg",
      batchNumber: "AMX-2024-055",
      expiryDate: "06/2025",
    },
    document: {
      materialName: "Amoxicillin 250mg",
      batchNumber: "AMX-2024-099", // ← BEDA
      expiryDate: "June 2025",
    },
  },

  {
    dir: "scenario-mismatch-02",
    desc: "Nama material beda (beda produk) → HIGH risk",
    expected: "MISMATCH | HIGH",
    label: {
      materialName: "Paracetamol 500mg",
      batchNumber: "BT-2024-300",
      expiryDate: "08/2026",
    },
    document: {
      materialName: "Ibuprofen 400mg", // ← BEDA
      batchNumber: "BT-2024-300",
      expiryDate: "August 2026",
    },
  },

  {
    dir: "scenario-mismatch-03",
    desc: "Batch number DAN nama material beda → HIGH risk",
    expected: "MISMATCH | HIGH",
    label: {
      materialName: "Metformin 850mg",
      batchNumber: "MET-2024-101",
      expiryDate: "11/2025",
    },
    document: {
      materialName: "Metformin 500mg", // ← BEDA
      batchNumber: "MET-2024-202", // ← BEDA
      expiryDate: "November 2025",
      manufacturer: "PT Indofarma",
      qcManager: "Dr. Hendra Wijaya",
    },
  },

  {
    dir: "scenario-mismatch-04",
    desc: "Expiry date beda bulan → MISMATCH",
    expected: "MISMATCH",
    label: {
      materialName: "Cetirizine 10mg",
      batchNumber: "CTZ-2024-050",
      expiryDate: "03/2026", // Maret
    },
    document: {
      materialName: "Cetirizine 10mg",
      batchNumber: "CTZ-2024-050",
      expiryDate: "September 2026", // ← BEDA bulan
      docType: "CERTIFICATE OF ANALYSIS",
      qcManager: "Dr. Dewi Lestari",
    },
  },

  {
    dir: "scenario-mismatch-05",
    desc: "Expiry date beda tahun → MISMATCH",
    expected: "MISMATCH",
    label: {
      materialName: "Omeprazole 20mg",
      batchNumber: "OMP-2024-333",
      expiryDate: "05/2025", // 2025
    },
    document: {
      materialName: "Omeprazole 20mg",
      batchNumber: "OMP-2024-333",
      expiryDate: "May 2027", // ← BEDA tahun
      manufacturer: "PT Kalbe Farma",
      qcManager: "Dr. Yusuf Hakim",
      releaseDate: "20 May 2024",
    },
  },
];

// ─── Generate All Files ───────────────────────────────────────────────────────

const validCount = scenarios.filter((s) =>
  s.dir.startsWith("scenario-valid"),
).length;
const mismatchCount = scenarios.filter((s) =>
  s.dir.startsWith("scenario-mismatch"),
).length;

console.log(
  `Generating ${scenarios.length} scenarios (${validCount} valid, ${mismatchCount} mismatch)...\n`,
);

for (const scenario of scenarios) {
  const dir = path.join(__dirname, scenario.dir);
  ensureDir(dir);

  // Header color: biru untuk valid, merah tua untuk mismatch
  const isValid = scenario.dir.startsWith("scenario-valid");
  const headerColor = isValid ? [30, 80, 160] : [160, 30, 30];

  const labelPNG = makeLabelPNG(scenario.label, headerColor);
  fs.writeFileSync(path.join(dir, "label.png"), labelPNG);

  const docPDF = makeDocumentPDF(scenario.document);
  fs.writeFileSync(path.join(dir, "document.pdf"), docPDF);

  console.log(`✓ ${scenario.dir}/`);
  console.log(`  Desc    : ${scenario.desc}`);
  console.log(`  Expected: ${scenario.expected}`);
  console.log();
}

console.log("─".repeat(60));
console.log("Done! Semua file ada di test-data/\n");
console.log("VALID scenarios (ekspektasi: VALID, RISIKO RENDAH):");
scenarios
  .filter((s) => s.dir.startsWith("scenario-valid"))
  .forEach((s) => {
    console.log(`  ${s.dir.padEnd(25)} ${s.desc}`);
  });
console.log("\nMISMATCH scenarios (ekspektasi: MISMATCH/SUSPICIOUS):");
scenarios
  .filter((s) => s.dir.startsWith("scenario-mismatch"))
  .forEach((s) => {
    console.log(`  ${s.dir.padEnd(25)} ${s.desc} → ${s.expected}`);
  });
