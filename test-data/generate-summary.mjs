/**
 * Generate test-data/testdata.pdf
 * Rangkuman semua dummy test data untuk Medify AI
 * Jalankan: node test-data/generate-summary.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Escape PDF string ────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

// ─── Simple sequential PDF builder ───────────────────────────────────────────
// Builds objects in order, tracks byte offsets, writes valid xref table.

class PDF {
  constructor() {
    this._buf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    this._offsets = []; // index = objId - 1
    this._pageIds = [];
    this._nextId = 1;

    // Reserve obj 1 = catalog, 2 = pages, 3 = font-regular, 4 = font-bold
    // We'll write them last once we know page IDs
    this._catalogId = 1;
    this._pagesId = 2;
    this._fontRegId = 3;
    this._fontBoldId = 4;
    this._nextId = 5; // dynamic objects start at 5
  }

  // Write a raw object and record its offset
  _writeObj(id, content) {
    // Pad offsets array
    while (this._offsets.length < id) this._offsets.push(0);
    this._offsets[id - 1] = this._buf.length;
    this._buf += `${id} 0 obj\n${content}\nendobj\n`;
  }

  // Allocate next id
  _alloc() {
    return this._nextId++;
  }

  // Add a page given an array of PDF operator strings
  addPage(ops) {
    const stream = ops.join("\n");
    const len = Buffer.byteLength(stream, "latin1");

    const contentId = this._alloc();
    const pageId = this._alloc();

    this._writeObj(
      contentId,
      `<< /Length ${len} >>\nstream\n${stream}\nendstream`,
    );
    this._writeObj(
      pageId,
      `<< /Type /Page /Parent ${this._pagesId} 0 R\n` +
        `   /MediaBox [0 0 595 842]\n` +
        `   /Contents ${contentId} 0 R\n` +
        `   /Resources << /Font << /F1 ${this._fontRegId} 0 R /F2 ${this._fontBoldId} 0 R >> >> >>`,
    );
    this._pageIds.push(pageId);
  }

  // Finalize and return Buffer
  build() {
    const totalObjs = this._nextId - 1; // highest id used so far (dynamic)
    // We still need to write objs 1-4 which were reserved but not yet written

    // Font regular
    this._writeObj(
      this._fontRegId,
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
    );
    // Font bold
    this._writeObj(
      this._fontBoldId,
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`,
    );
    // Pages
    const kids = this._pageIds.map((id) => `${id} 0 R`).join(" ");
    this._writeObj(
      this._pagesId,
      `<< /Type /Pages /Kids [${kids}] /Count ${this._pageIds.length} >>`,
    );
    // Catalog
    this._writeObj(
      this._catalogId,
      `<< /Type /Catalog /Pages ${this._pagesId} 0 R >>`,
    );

    const highestId = this._nextId - 1;
    const xrefOffset = this._buf.length;

    // xref
    this._buf += `xref\n0 ${highestId + 1}\n`;
    this._buf += "0000000000 65535 f \n";
    for (let i = 1; i <= highestId; i++) {
      const off = this._offsets[i - 1] ?? 0;
      this._buf += String(off).padStart(10, "0") + " 00000 n \n";
    }

    this._buf +=
      `trailer\n<< /Size ${highestId + 1} /Root ${this._catalogId} 0 R >>\n` +
      `startxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(this._buf, "latin1");
  }
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

const rgb = (r, g, b) => {
  const f = (v) => (v / 255).toFixed(3);
  return `${f(r)} ${f(g)} ${f(b)} rg ${f(r)} ${f(g)} ${f(b)} RG`;
};
const black = () => `0 0 0 rg 0 0 0 RG`;
const white = () => `1 1 1 rg 1 1 1 RG`;
const lw = (w) => `${w} w`;
const fillRect = (x, y, w, h) => `${x} ${y} ${w} ${h} re f`;
const strokeRect = (x, y, w, h) => `${x} ${y} ${w} ${h} re S`;
const hline = (x1, y, x2) => `${x1} ${y} m ${x2} ${y} l S`;
const txt = (x, y, str, size, bold = false) =>
  `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${esc(str)}) Tj ET`;

// ─── Scenario data ────────────────────────────────────────────────────────────

const scenarios = [
  {
    id: "valid-01",
    cat: "VALID",
    risk: "LOW",
    desc: "Semua field identik persis",
    lMat: "Paracetamol 500mg",
    lBat: "BT-2024-001",
    lExp: "01/2026",
    dMat: "Paracetamol 500mg",
    dBat: "BT-2024-001",
    dExp: "01/2026",
    note: "Semua field cocok persis, tidak ada perbedaan sama sekali.",
  },
  {
    id: "valid-02",
    cat: "VALID",
    risk: "LOW",
    desc: "Expiry date: MM/YYYY vs Month YYYY",
    lMat: "Ibuprofen 400mg",
    lBat: "IBU-2024-088",
    lExp: "03/2027",
    dMat: "Ibuprofen 400mg",
    dBat: "IBU-2024-088",
    dExp: "March 2027",
    note: "03/2027 = March 2027, dikenali sama secara semantik.",
  },
  {
    id: "valid-03",
    cat: "VALID",
    risk: "LOW",
    desc: "Expiry date: YYYY-MM vs MM/YYYY",
    lMat: "Metformin 500mg",
    lBat: "MET-2023-412",
    lExp: "09/2025",
    dMat: "Metformin 500mg",
    dBat: "MET-2023-412",
    dExp: "2025-09",
    note: "Format ISO 2025-09 dikenali sama dengan 09/2025.",
  },
  {
    id: "valid-04",
    cat: "VALID",
    risk: "LOW",
    desc: "Nama material UPPERCASE vs Titlecase",
    lMat: "AMOXICILLIN 500MG",
    lBat: "AMX-2024-200",
    lExp: "12/2026",
    dMat: "Amoxicillin 500mg",
    dBat: "AMX-2024-200",
    dExp: "December 2026",
    note: "Perbedaan huruf kapital diabaikan (case-insensitive).",
  },
  {
    id: "valid-05",
    cat: "VALID",
    risk: "LOW",
    desc: "Expiry date: Jun vs June (singkatan bulan)",
    lMat: "Ciprofloxacin 500mg",
    lBat: "CIP-2024-777",
    lExp: "Jun 2026",
    dMat: "Ciprofloxacin 500mg",
    dBat: "CIP-2024-777",
    dExp: "June 2026",
    note: "Singkatan Jun dikenali sama dengan June.",
  },
  {
    id: "mismatch-01",
    cat: "MISMATCH",
    risk: "HIGH",
    desc: "Batch number berbeda",
    lMat: "Amoxicillin 250mg",
    lBat: "AMX-2024-055",
    lExp: "06/2025",
    dMat: "Amoxicillin 250mg",
    dBat: "AMX-2024-099",
    dExp: "June 2025",
    note: "Batch number berbeda (055 vs 099). Risiko TINGGI.",
  },
  {
    id: "mismatch-02",
    cat: "MISMATCH",
    risk: "HIGH",
    desc: "Nama material berbeda (beda produk)",
    lMat: "Paracetamol 500mg",
    lBat: "BT-2024-300",
    lExp: "08/2026",
    dMat: "Ibuprofen 400mg",
    dBat: "BT-2024-300",
    dExp: "August 2026",
    note: "Nama material berbeda total. Risiko TINGGI.",
  },
  {
    id: "mismatch-03",
    cat: "MISMATCH",
    risk: "HIGH",
    desc: "Batch number DAN nama material keduanya berbeda",
    lMat: "Metformin 850mg",
    lBat: "MET-2024-101",
    lExp: "11/2025",
    dMat: "Metformin 500mg",
    dBat: "MET-2024-202",
    dExp: "November 2025",
    note: "Dua field kritis berbeda sekaligus. Risiko TINGGI.",
  },
  {
    id: "mismatch-04",
    cat: "MISMATCH",
    risk: "MEDIUM",
    desc: "Expiry date beda bulan (Mar vs Sep)",
    lMat: "Cetirizine 10mg",
    lBat: "CTZ-2024-050",
    lExp: "03/2026",
    dMat: "Cetirizine 10mg",
    dBat: "CTZ-2024-050",
    dExp: "September 2026",
    note: "Tanggal kedaluwarsa berbeda bulan. Perlu verifikasi ulang.",
  },
  {
    id: "mismatch-05",
    cat: "MISMATCH",
    risk: "MEDIUM",
    desc: "Expiry date beda tahun (2025 vs 2027)",
    lMat: "Omeprazole 20mg",
    lBat: "OMP-2024-333",
    lExp: "05/2025",
    dMat: "Omeprazole 20mg",
    dBat: "OMP-2024-333",
    dExp: "May 2027",
    note: "Tanggal kedaluwarsa berbeda tahun (2025 vs 2027).",
  },
];

const validList = scenarios.filter((s) => s.cat === "VALID");
const mismatchList = scenarios.filter((s) => s.cat === "MISMATCH");

// ─── Color constants ──────────────────────────────────────────────────────────
const C = {
  navy: [20, 60, 120],
  green: [20, 120, 60],
  red: [160, 40, 40],
  orange: [180, 100, 0],
  lightBlue: [230, 238, 255],
  lightGreen: [230, 248, 230],
  lightRed: [255, 235, 235],
  gray: [200, 200, 200],
  rowAlt: [245, 248, 255],
};

// ─── Page 1: Cover ────────────────────────────────────────────────────────────
function buildCoverPage() {
  const ops = [];
  ops.push(lw(0.5));

  // Header bar
  ops.push(rgb(...C.navy));
  ops.push(fillRect(0, 790, 595, 52));
  ops.push(white());
  ops.push(txt(40, 820, "Medify AI  —  Test Data Summary", 20, true));
  ops.push(
    txt(
      40,
      800,
      "Rangkuman Dummy Data untuk Testing Verifikasi Material Farmasi",
      11,
    ),
  );
  ops.push(black());

  // Info box
  ops.push(rgb(...C.lightBlue));
  ops.push(fillRect(40, 730, 515, 50));
  ops.push(rgb(...C.navy));
  ops.push(strokeRect(40, 730, 515, 50));
  ops.push(black());
  ops.push(
    txt(
      52,
      762,
      "Dokumen ini berisi 10 skenario test data untuk menguji sistem verifikasi Medify AI.",
      10,
    ),
  );
  ops.push(
    txt(
      52,
      748,
      "Setiap skenario terdiri dari: label.png (gambar label kemasan) + document.pdf (CoA).",
      10,
    ),
  );
  ops.push(
    txt(
      52,
      734,
      "Generated: " +
        new Date().toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
      9,
    ),
  );

  // Stat boxes
  const stats = [
    { label: "Total Skenario", val: "10", col: C.navy },
    { label: "Skenario VALID", val: "5", col: C.green },
    { label: "Skenario MISMATCH", val: "5", col: C.red },
  ];
  stats.forEach((s, i) => {
    const bx = 40 + i * 178;
    ops.push(rgb(...s.col));
    ops.push(fillRect(bx, 650, 165, 65));
    ops.push(white());
    ops.push(txt(bx + 8, 700, s.label, 9, true));
    ops.push(txt(bx + 8, 665, s.val, 30, true));
    ops.push(black());
  });

  // Legend
  ops.push(txt(40, 630, "Keterangan Warna:", 11, true));
  ops.push(rgb(...C.green));
  ops.push(fillRect(40, 608, 12, 12));
  ops.push(black());
  ops.push(
    txt(
      58,
      610,
      "VALID  —  Semua field cocok. Ekspektasi: status VALID, risiko RENDAH (LOW).",
      10,
    ),
  );
  ops.push(rgb(...C.red));
  ops.push(fillRect(40, 590, 12, 12));
  ops.push(black());
  ops.push(
    txt(
      58,
      592,
      "MISMATCH  —  Ada field berbeda. Ekspektasi: status MISMATCH, risiko TINGGI/SEDANG.",
      10,
    ),
  );

  // Table header
  ops.push(rgb(...C.navy));
  ops.push(fillRect(40, 555, 515, 22));
  ops.push(white());
  ops.push(txt(48, 562, "Daftar Semua Skenario", 11, true));
  ops.push(black());

  // Column headers
  ops.push(rgb(215, 225, 245));
  ops.push(fillRect(40, 534, 515, 18));
  ops.push(black());
  ops.push(txt(48, 539, "No", 8, true));
  ops.push(txt(68, 539, "Folder", 8, true));
  ops.push(txt(220, 539, "Deskripsi", 8, true));
  ops.push(txt(415, 539, "Kategori", 8, true));
  ops.push(txt(480, 539, "Risk", 8, true));
  ops.push(txt(520, 539, "Hal.", 8, true));

  // Rows
  scenarios.forEach((s, i) => {
    const ry = 518 - i * 17;
    if (i % 2 === 0) {
      ops.push(rgb(...C.rowAlt));
      ops.push(fillRect(40, ry - 3, 515, 16));
      ops.push(black());
    }
    const catCol = s.cat === "VALID" ? C.green : C.red;
    const riskCol =
      s.risk === "HIGH" ? C.red : s.risk === "MEDIUM" ? C.orange : C.green;
    const page = s.cat === "VALID" ? 2 : 3;

    ops.push(txt(48, ry, String(i + 1), 8));
    ops.push(txt(68, ry, `scenario-${s.id}`, 8));
    ops.push(txt(220, ry, s.desc.substring(0, 36), 8));
    ops.push(rgb(...catCol));
    ops.push(txt(415, ry, s.cat, 8, true));
    ops.push(rgb(...riskCol));
    ops.push(txt(480, ry, s.risk, 8, true));
    ops.push(black());
    ops.push(txt(520, ry, String(page), 8));
  });

  // Footer
  ops.push(rgb(...C.gray));
  ops.push(hline(40, 28, 555));
  ops.push(black());
  ops.push(txt(40, 16, "Medify AI Test Data  |  Halaman 1 dari 3", 8));

  return ops;
}

// ─── Scenario card builder ────────────────────────────────────────────────────
function buildCard(ops, s, topY, cardColor, headerColor) {
  const H = 108; // card height

  // Card background
  ops.push(rgb(...cardColor));
  ops.push(fillRect(40, topY - H, 515, H));
  ops.push(rgb(...headerColor));
  ops.push(strokeRect(40, topY - H, 515, H));

  // Card header bar
  ops.push(rgb(...headerColor));
  ops.push(fillRect(40, topY - 18, 515, 18));
  ops.push(white());
  ops.push(txt(48, topY - 13, `scenario-${s.id}  —  ${s.desc}`, 9, true));
  ops.push(black());

  // Column headers
  ops.push(rgb(220, 230, 220));
  ops.push(fillRect(48, topY - 34, 499, 14));
  ops.push(black());
  ops.push(txt(52, topY - 30, "Field", 7, true));
  ops.push(txt(170, topY - 30, "Nilai Label  (label.png)", 7, true));
  ops.push(txt(355, topY - 30, "Nilai Dokumen  (document.pdf)", 7, true));
  ops.push(txt(530, topY - 30, "Status", 7, true));

  // Field rows
  const rows = [
    ["Nama Material", s.lMat, s.dMat],
    ["Batch Number", s.lBat, s.dBat],
    ["Expiry Date", s.lExp, s.dExp],
  ];
  rows.forEach(([fname, lv, dv], fi) => {
    const fy = topY - 48 - fi * 15;
    const diff = lv.toLowerCase().trim() !== dv.toLowerCase().trim();

    if (diff) {
      ops.push(rgb(...C.lightRed));
      ops.push(fillRect(48, fy - 3, 499, 13));
    } else if (fi % 2 === 0) {
      ops.push(rgb(240, 248, 240));
      ops.push(fillRect(48, fy - 3, 499, 13));
    }
    ops.push(black());
    ops.push(txt(52, fy, fname, 7));
    ops.push(txt(170, fy, lv.substring(0, 28), 7));
    ops.push(txt(355, fy, dv.substring(0, 28), 7));
    if (diff) {
      ops.push(rgb(...C.red));
      ops.push(txt(530, fy, "BEDA", 7, true));
    } else {
      ops.push(rgb(...C.green));
      ops.push(txt(530, fy, "OK", 7, true));
    }
    ops.push(black());
  });

  // Note
  ops.push(txt(52, topY - H + 8, `Catatan: ${s.note.substring(0, 95)}`, 7));
}

// ─── Page 2: VALID detail ─────────────────────────────────────────────────────
function buildValidPage() {
  const ops = [];
  ops.push(lw(0.5));

  // Header
  ops.push(rgb(...C.green));
  ops.push(fillRect(0, 800, 595, 42));
  ops.push(white());
  ops.push(txt(40, 824, "Skenario VALID  (5 skenario)", 15, true));
  ops.push(
    txt(40, 808, "Ekspektasi: Status VALID  |  Risiko RENDAH (LOW)", 10),
  );
  ops.push(black());

  let y = 782;
  validList.forEach((s) => {
    buildCard(ops, s, y, [240, 252, 240], C.green);
    y -= 120;
  });

  // Footer
  ops.push(rgb(...C.gray));
  ops.push(hline(40, 28, 555));
  ops.push(black());
  ops.push(txt(40, 16, "Medify AI Test Data  |  Halaman 2 dari 3", 8));

  return ops;
}

// ─── Page 3: MISMATCH detail ──────────────────────────────────────────────────
function buildMismatchPage() {
  const ops = [];
  ops.push(lw(0.5));

  // Header
  ops.push(rgb(...C.red));
  ops.push(fillRect(0, 800, 595, 42));
  ops.push(white());
  ops.push(txt(40, 824, "Skenario MISMATCH  (5 skenario)", 15, true));
  ops.push(
    txt(40, 808, "Ekspektasi: Status MISMATCH  |  Risiko HIGH atau MEDIUM", 10),
  );
  ops.push(black());

  let y = 782;
  mismatchList.forEach((s) => {
    const hCol = s.risk === "HIGH" ? C.red : C.orange;
    buildCard(ops, s, y, [252, 242, 242], hCol);

    // Risk badge
    ops.push(rgb(...hCol));
    ops.push(txt(490, y - 13, `RISK: ${s.risk}`, 8, true));
    ops.push(black());

    y -= 120;
  });

  // Footer
  ops.push(rgb(...C.gray));
  ops.push(hline(40, 28, 555));
  ops.push(black());
  ops.push(txt(40, 16, "Medify AI Test Data  |  Halaman 3 dari 3", 8));

  return ops;
}

// ─── Build & write ────────────────────────────────────────────────────────────

const pdf = new PDF();
pdf.addPage(buildCoverPage());
pdf.addPage(buildValidPage());
pdf.addPage(buildMismatchPage());

const outPath = path.join(__dirname, "testdata.pdf");
fs.writeFileSync(outPath, pdf.build());
console.log(
  `✓ test-data/testdata.pdf  (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB, 3 halaman)`,
);
