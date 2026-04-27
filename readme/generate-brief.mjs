/**
 * Generate readme/project-brief.pdf
 * Project Brief Hackathon Microsoft Elevate Training Center
 * Jalankan: node readme/generate-brief.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function esc(str) {
  return String(str ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

// ─── Sequential PDF builder ───────────────────────────────────────────────────
class PDF {
  constructor() {
    this._buf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    this._offsets = [];
    this._pageIds = [];
    this._nextId = 5;
  }
  _writeObj(id, content) {
    while (this._offsets.length < id) this._offsets.push(0);
    this._offsets[id - 1] = this._buf.length;
    this._buf += `${id} 0 obj\n${content}\nendobj\n`;
  }
  _alloc() {
    return this._nextId++;
  }
  addPage(ops) {
    const stream = ops.join("\n");
    const len = Buffer.byteLength(stream, "latin1");
    const cid = this._alloc();
    const pid = this._alloc();
    this._writeObj(cid, `<< /Length ${len} >>\nstream\n${stream}\nendstream`);
    this._writeObj(
      pid,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]\n` +
        `   /Contents ${cid} 0 R\n` +
        `   /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
    );
    this._pageIds.push(pid);
  }
  build() {
    this._writeObj(3, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
    this._writeObj(
      4,
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`,
    );
    const kids = this._pageIds.map((id) => `${id} 0 R`).join(" ");
    this._writeObj(
      2,
      `<< /Type /Pages /Kids [${kids}] /Count ${this._pageIds.length} >>`,
    );
    this._writeObj(1, `<< /Type /Catalog /Pages 2 0 R >>`);
    const high = this._nextId - 1;
    const xrefOff = this._buf.length;
    this._buf += `xref\n0 ${high + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= high; i++)
      this._buf +=
        String(this._offsets[i - 1] ?? 0).padStart(10, "0") + " 00000 n \n";
    this._buf += `trailer\n<< /Size ${high + 1} /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`;
    return Buffer.from(this._buf, "latin1");
  }
}

// ─── PDF drawing primitives ───────────────────────────────────────────────────
// NOTE: PDF coordinate origin is BOTTOM-LEFT. Y increases upward.
// All helpers below use PDF native coordinates directly.

const rgb = (r, g, b) => {
  const f = (v) => (v / 255).toFixed(3);
  return `${f(r)} ${f(g)} ${f(b)} rg ${f(r)} ${f(g)} ${f(b)} RG`;
};
const black = () => `0 0 0 rg 0 0 0 RG`;
const white = () => `1 1 1 rg 1 1 1 RG`;
const lw = (w) => `${w} w`;
// fill/stroke: x,y = bottom-left corner, w,h = width/height
const fillR = (x, y, w, h) => `${x} ${y} ${w} ${h} re f`;
const strokeR = (x, y, w, h) => `${x} ${y} ${w} ${h} re S`;
const hline = (x1, y, x2) => `${x1} ${y} m ${x2} ${y} l S`;
// T: x,y = text baseline position
const T = (x, y, s, sz, bold = false) =>
  `BT /${bold ? "F2" : "F1"} ${sz} Tf ${x} ${y} Td (${esc(s)}) Tj ET`;

// ─── Text wrap ────────────────────────────────────────────────────────────────
// Helvetica avg char width ≈ 0.50 × fontSize
function wrap(text, fontSize, maxPts) {
  const cw = 0.5 * fontSize;
  const words = String(text).split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? cur + " " + w : w;
    if (candidate.length * cw <= maxPts) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      if (w.length * cw > maxPts) {
        const maxC = Math.floor(maxPts / cw);
        let rem = w;
        while (rem.length > maxC) {
          lines.push(rem.slice(0, maxC));
          rem = rem.slice(maxC);
        }
        cur = rem;
      } else {
        cur = w;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ─── Layout helpers (top-down, Y = top of element in PDF coords) ─────────────
// "top" = PDF Y of the TOP edge of the element.
// Text baseline = top - fontSize (text sits just below the top edge).

/** Draw text line. Returns PDF Y of baseline. */
function textLine(ops, x, top, str, fontSize, bold = false) {
  const baseline = top - fontSize;
  ops.push(T(x, baseline, str, fontSize, bold));
  return baseline;
}

/** Draw wrapped paragraph. Returns PDF Y of bottom of last line. */
function para(ops, x, top, text, fontSize, maxPts, lineH) {
  const lines = wrap(text, fontSize, maxPts);
  let y = top;
  for (const line of lines) {
    textLine(ops, x, y, line, fontSize);
    y -= lineH;
  }
  return y; // bottom of last line
}

/** Measure height of wrapped paragraph. */
function paraH(text, fontSize, maxPts, lineH) {
  return wrap(text, fontSize, maxPts).length * lineH;
}

/** Draw section heading with left accent bar. Returns Y of bottom. */
function secHead(ops, top, title, col, fontSize = 11) {
  const barH = fontSize + 6;
  ops.push(rgb(...col));
  ops.push(fillR(ML, top - barH, 4, barH));
  ops.push(black());
  textLine(ops, ML + 10, top - 2, title, fontSize, true);
  return top - barH - 6;
}

/** Draw bullet item. Returns Y of bottom. */
function bullet(ops, top, text, fontSize, maxPts, lineH, col = NAVY) {
  ops.push(rgb(...col));
  textLine(ops, ML + 6, top, "-", fontSize, true);
  ops.push(black());
  const lines = wrap(text, fontSize, maxPts - 14);
  let y = top;
  for (const line of lines) {
    textLine(ops, ML + 20, y, line, fontSize);
    y -= lineH;
  }
  return y - 2;
}

/** Draw filled+stroked rect given top-left corner. */
function boxTop(ops, x, top, w, h, fillCol, strokeCol) {
  const pdfY = top - h;
  if (fillCol) {
    ops.push(rgb(...fillCol));
    ops.push(fillR(x, pdfY, w, h));
  }
  if (strokeCol) {
    ops.push(rgb(...strokeCol));
    ops.push(strokeR(x, pdfY, w, h));
  }
  ops.push(black());
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const NAVY = [20, 60, 120];
const BLUE = [0, 102, 204];
const TEAL = [0, 128, 128];
const GRAY = [180, 180, 180];
const LGRAY = [245, 247, 252];
const LBLUE = [232, 242, 255];
const ORANGE = [180, 100, 0];

const ML = 44;
const CW = 507; // 595 - 44 - 44
const PW = 595;
const PH = 842;

const LH = 11; // standard line height
const GAP = 8; // gap between sections

// ─── Page header strip (page 2+) ─────────────────────────────────────────────
function pageHeaderStrip(ops, subtitle) {
  // Strip at top: y=814 to y=842 (height=28)
  ops.push(rgb(...NAVY));
  ops.push(fillR(0, 814, PW, 28));
  ops.push(rgb(...BLUE));
  ops.push(fillR(0, 810, PW, 4));
  ops.push(white());
  ops.push(T(ML, 824, "Medify AI  -  Project Brief", 9, true));
  if (subtitle) ops.push(T(ML + 270, 824, subtitle, 8));
  ops.push(black());
}

// ─── Page footer ─────────────────────────────────────────────────────────────
function pageFooter(ops, pageNum, total) {
  ops.push(rgb(...GRAY));
  ops.push(lw(0.5));
  ops.push(hline(ML, 30, PW - ML));
  ops.push(black());
  ops.push(
    T(
      ML,
      18,
      "Medify AI  |  Project Brief  |  Hackathon Microsoft Elevate Training Center",
      7,
    ),
  );
  ops.push(T(PW - ML - 18, 18, `${pageNum} / ${total}`, 7));
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE 1 — Cover + Ringkasan Eksekutif
// ══════════════════════════════════════════════════════════════════════════════
function page1() {
  const ops = [];
  ops.push(lw(0.5));

  // ── Cover header: fills top 90pt (y=752..842) ──
  ops.push(rgb(...NAVY));
  ops.push(fillR(0, 752, PW, 90));
  ops.push(rgb(...BLUE));
  ops.push(fillR(0, 748, PW, 5));
  ops.push(white());
  ops.push(
    T(
      ML,
      822,
      "PROJECT BRIEF  -  Hackathon Microsoft Elevate Training Center",
      9,
      true,
    ),
  );
  ops.push(T(ML, 804, "Medify AI", 20, true));
  ops.push(
    T(ML, 782, "Automated Pharmaceutical Material Verification System", 10),
  );
  ops.push(T(ML, 766, "Topik: Pharma / Health", 8));
  ops.push(black());

  // ── Meta row: y=728..744 ──
  ops.push(rgb(...LGRAY));
  ops.push(fillR(ML, 728, CW, 16));
  ops.push(rgb(...NAVY));
  ops.push(strokeR(ML, 728, CW, 16));
  ops.push(black());
  ops.push(T(ML + 6, 732, "Kategori: Pharma / Health", 7.5));
  ops.push(T(ML + 180, 732, "Platform: Web Application", 7.5));
  ops.push(T(ML + 340, 732, "Stack: SvelteKit + Node.js + Azure AI", 7.5));

  // ── Content starts at top=720 (just below meta row) ──
  // All positions below use "top" = PDF Y of top edge of element.
  let top = 720;

  // Section heading
  top = secHead(ops, top, "1.  Ringkasan Eksekutif", NAVY, 11);

  // ── Problem Statement box ──
  const psText =
    "Industri farmasi menghadapi risiko serius akibat ketidaksesuaian data antara label fisik " +
    "kemasan dan dokumen pendukung resmi (Certificate of Analysis). Kesalahan manual dalam " +
    "verifikasi — batch number tertukar, nama material salah, atau expiry date tidak cocok — " +
    "dapat menyebabkan penarikan produk, kerugian finansial, bahkan membahayakan keselamatan pasien.";
  const psLines = wrap(psText, 7.5, CW - 16);
  const psBodyH = psLines.length * LH + 6; // text lines + bottom padding
  const psHeaderH = 14; // blue header bar height
  const psTotal = psHeaderH + psBodyH; // total box height

  // Draw box background (full box)
  boxTop(ops, ML, top, CW, psTotal, LBLUE, BLUE);
  // Draw blue header bar inside box (top portion)
  ops.push(rgb(...BLUE));
  ops.push(fillR(ML, top - psHeaderH, CW, psHeaderH));
  ops.push(white());
  // Header label: baseline = top - psHeaderH + 4 (4pt from bottom of header bar)
  ops.push(T(ML + 6, top - psHeaderH + 4, "Problem Statement", 8, true));
  ops.push(black());
  // Text lines: start just below header bar
  let ty = top - psHeaderH - LH; // top of first text line
  for (const line of psLines) {
    textLine(ops, ML + 6, ty, line, 7.5);
    ty -= LH;
  }
  top = top - psTotal - GAP;

  // ── Research Questions ──
  top = secHead(ops, top, "Research Questions", TEAL, 9);
  top = bullet(
    ops,
    top,
    "Bagaimana sistem mengekstraksi data kritis dari label kemasan secara otomatis dan akurat?",
    7.5,
    CW - 12,
    LH,
  );
  top = bullet(
    ops,
    top,
    "Seberapa efektif AI mendeteksi ketidaksesuaian data antara label dan dokumen pendukung?",
    7.5,
    CW - 12,
    LH,
  );
  top = bullet(
    ops,
    top,
    "Bagaimana menyajikan hasil verifikasi dengan risk scoring yang actionable bagi tim QC?",
    7.5,
    CW - 12,
    LH,
  );
  top -= GAP;

  // ── Latar Belakang ──
  top = secHead(ops, top, "Latar Belakang", TEAL, 9);
  top = para(
    ops,
    ML + 6,
    top,
    "Proses verifikasi material farmasi saat ini dilakukan secara manual oleh tim QC, " +
      "membutuhkan 15-30 menit per batch dan rentan human error. Regulasi BPOM dan GMP " +
      "mewajibkan dokumentasi ketat, namun alat bantu digital terintegrasi masih sangat " +
      "terbatas di industri farmasi Indonesia.",
    7.5,
    CW - 12,
    LH,
  );
  top -= GAP;

  // ── Mengapa proyek ini ──
  top = secHead(
    ops,
    top,
    "Mengapa Proyek Ini?  (Painkiller, bukan Vitamin)",
    TEAL,
    9,
  );
  top = para(
    ops,
    ML + 6,
    top,
    "Medify AI hadir sebagai solusi painkiller — menyelesaikan masalah nyata di lantai produksi " +
      "farmasi setiap hari. Sistem memangkas waktu verifikasi dari 30 menit menjadi kurang dari " +
      "60 detik, mengurangi risiko human error secara signifikan, dan memberikan audit trail " +
      "digital yang dapat dipertanggungjawabkan kepada regulator.",
    7.5,
    CW - 12,
    LH,
  );

  pageFooter(ops, 1, 3);
  return ops;
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE 2 — Deskripsi Produk + Fitur + Teknologi
// ══════════════════════════════════════════════════════════════════════════════
function page2() {
  const ops = [];
  ops.push(lw(0.5));
  pageHeaderStrip(ops, "Deskripsi Produk  |  Fitur  |  Teknologi");

  let top = 800;

  // ── Section 2: Deskripsi Produk ──
  top = secHead(ops, top, "2.  Deskripsi Produk / Aplikasi", NAVY, 11);

  const dp1 = wrap(
    "Aplikasi web berbasis AI yang membantu tim QC farmasi memverifikasi kesesuaian data material " +
      "antara label fisik kemasan dan dokumen pendukung resmi (CoA, Packing List) secara otomatis.",
    7.5,
    CW - 16,
  );
  const dp2 = wrap(
    "Pengguna upload foto label kemasan dan PDF dokumen pendukung. Sistem ekstrak data via OCR, " +
      "bandingkan field kritis, beri risk score, dan hasilkan penjelasan AI dalam Bahasa Indonesia.",
    7.5,
    CW - 16,
  );
  const dpH = 14 + (dp1.length + dp2.length) * LH + 10;
  boxTop(ops, ML, top, CW, dpH, LGRAY, NAVY);
  ops.push(T(ML + 8, top - 12, "Medify AI", 10, true));
  let ty = top - 14 - LH;
  for (const l of dp1) {
    textLine(ops, ML + 8, ty, l, 7.5);
    ty -= LH;
  }
  ty -= 4;
  for (const l of dp2) {
    textLine(ops, ML + 8, ty, l, 7.5);
    ty -= LH;
  }
  top = top - dpH - GAP;

  // ── Section 3: Fitur Utama ──
  top = secHead(ops, top, "3.  Fitur Utama", NAVY, 11);

  const features = [
    [
      "OCR Otomatis (Azure Document Intelligence)",
      "Ekstraksi data dari gambar label (JPG/PNG/WEBP) dan PDF tanpa input manual.",
    ],
    [
      "Validasi & Deteksi Mismatch Cerdas",
      "Normalisasi format tanggal (01/2026 = January 2026) dan case-insensitive matching.",
    ],
    [
      "Risk Scoring Otomatis",
      "HIGH: batch/material beda. MEDIUM: expiry beda. LOW: semua field cocok.",
    ],
    [
      "Penjelasan AI Bahasa Indonesia",
      "Azure OpenAI GPT-4o hasilkan narasi penjelasan untuk tim QC non-teknis.",
    ],
    [
      "Antarmuka Web Responsif",
      "SvelteKit frontend: upload drag-and-drop, loading indicator, highlight mismatch.",
    ],
    [
      "Zero Data Retention",
      "File dihapus dari Blob Storage setelah OCR selesai. Tidak ada database permanen.",
    ],
  ];

  for (let i = 0; i < features.length; i++) {
    const [title, desc] = features[i];
    const descLines = wrap(desc, 7.5, CW - 20);
    const cardH = 12 + descLines.length * 10 + 6;
    const bgColor = i % 2 === 0 ? LBLUE : LGRAY;
    boxTop(ops, ML, top, CW, cardH, bgColor, null);
    ops.push(rgb(...BLUE));
    ops.push(fillR(ML, top - cardH, 4, cardH)); // left accent
    ops.push(black());
    textLine(ops, ML + 10, top - 2, `${i + 1}.  ${title}`, 8, true);
    let fy = top - 12;
    for (const l of descLines) {
      textLine(ops, ML + 10, fy, l, 7.5);
      fy -= 10;
    }
    top = top - cardH - 3;
  }
  top -= GAP;

  // ── Section 4: Teknologi ──
  top = secHead(ops, top, "4.  Teknologi yang Digunakan", NAVY, 11);

  const techGroups = [
    {
      label: "Frontend",
      items: ["SvelteKit 2.x + TypeScript", "Vite 6", "Svelte Store"],
    },
    {
      label: "Backend",
      items: [
        "Node.js / Express + TypeScript",
        "Multer (file upload)",
        "UUID, dotenv",
      ],
    },
    {
      label: "Azure AI",
      items: [
        "Document Intelligence (OCR)",
        "OpenAI GPT-4o",
        "Blob Storage (temp)",
      ],
    },
  ];

  const colW = Math.floor(CW / 3) - 4;
  techGroups.forEach(({ label, items }, ci) => {
    const cx = ML + ci * (colW + 6);
    // Header
    ops.push(rgb(...NAVY));
    ops.push(fillR(cx, top - 16, colW, 16));
    ops.push(white());
    ops.push(T(cx + 6, top - 12, label, 8, true));
    ops.push(black());
    // Items
    items.forEach((item, ii) => {
      const iy = top - 16 - (ii + 1) * 14;
      ops.push(rgb(...(ii % 2 === 0 ? LGRAY : [255, 255, 255])));
      ops.push(fillR(cx, iy, colW, 13));
      ops.push(black());
      ops.push(T(cx + 6, iy + 3, item, 7.5));
    });
  });

  pageFooter(ops, 2, 3);
  return ops;
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE 3 — Cara Penggunaan + Informasi Pendukung
// ══════════════════════════════════════════════════════════════════════════════
function page3() {
  const ops = [];
  ops.push(lw(0.5));
  pageHeaderStrip(ops, "Cara Penggunaan  |  Informasi Pendukung");

  let top = 800;

  // ── Section 5: Cara Penggunaan ──
  top = secHead(ops, top, "5.  Cara Penggunaan Produk", NAVY, 11);

  const steps = [
    [
      "Buka Aplikasi",
      "Akses http://localhost:5173. Halaman utama menampilkan form upload dua file.",
    ],
    [
      "Upload Label Kemasan",
      "Klik area Label Kemasan, pilih file gambar label (JPG/PNG/WEBP, maks. 10 MB).",
    ],
    [
      "Upload Dokumen Pendukung",
      "Klik area Dokumen Pendukung, pilih file PDF Certificate of Analysis (maks. 20 MB).",
    ],
    [
      "Klik Tombol Verifikasi",
      "Tekan tombol Verifikasi. Loading indicator tampil selama proses (10-30 detik).",
    ],
    [
      "Baca Hasil Verifikasi",
      "Tampil: badge Status (VALID/MISMATCH/SUSPICIOUS), badge Risk Level (HIGH/MEDIUM/LOW), " +
        "tabel perbandingan field dengan highlight merah pada field berbeda, dan penjelasan AI.",
    ],
    [
      "Verifikasi Berikutnya",
      "Upload file baru untuk verifikasi berikutnya. Tidak perlu refresh halaman.",
    ],
  ];

  for (let i = 0; i < steps.length; i++) {
    const [title, desc] = steps[i];
    const descLines = wrap(desc, 7.5, CW - 30);
    const rowH = 14 + descLines.length * LH + 4;
    if (i % 2 === 0) {
      boxTop(ops, ML, top, CW, rowH, LGRAY, null);
    }
    // Step number badge
    ops.push(rgb(...NAVY));
    ops.push(fillR(ML, top - 16, 18, 16));
    ops.push(white());
    ops.push(T(ML + 5, top - 12, String(i + 1), 8, true));
    ops.push(black());
    textLine(ops, ML + 24, top, title, 8, true);
    let sy = top - 12;
    for (const l of descLines) {
      textLine(ops, ML + 24, sy, l, 7.5);
      sy -= LH;
    }
    top = top - rowH - 4;
  }
  top -= GAP;

  // ── Demo access box ──
  const demoH = 38;
  boxTop(ops, ML, top, CW, demoH, [255, 251, 230], ORANGE);
  textLine(ops, ML + 8, top - 6, "Akses Demo", 8, true);
  textLine(ops, ML + 8, top - 18, "URL Dev  :  http://localhost:5173", 7.5);
  textLine(
    ops,
    ML + 8,
    top - 29,
    "Backend  :  http://localhost:3001  |  Auth: tidak diperlukan",
    7.5,
  );
  top = top - demoH - GAP;

  // ── Section 6: Informasi Pendukung ──
  top = secHead(ops, top, "6.  Informasi Pendukung", NAVY, 11);

  textLine(ops, ML + 6, top, "Alur Sistem:", 8, true);
  top -= 13;

  const flow = [
    "User upload label.png + document.pdf via browser",
    "Frontend POST /api/verify ke Express backend",
    "Backend upload file ke Azure Blob Storage, generate SAS URL",
    "Azure Document Intelligence OCR ekstrak teks dari kedua file",
    "Blob dihapus, Validator bandingkan field kritis",
    "Risk Scorer tentukan level, OpenAI GPT-4o generate penjelasan",
    "JSON response dikembalikan, hasil ditampilkan di frontend",
  ];
  flow.forEach((step, i) => {
    if (i % 2 === 0) {
      ops.push(rgb(...LGRAY));
      ops.push(fillR(ML + 4, top - 13, CW - 8, 13));
    }
    ops.push(rgb(...BLUE));
    textLine(ops, ML + 8, top, `${i + 1}.`, 7.5, true);
    ops.push(black());
    textLine(ops, ML + 22, top, step, 7.5);
    top -= 13;
  });
  top -= GAP;

  // ── Roadmap ──
  top = secHead(ops, top, "Rencana Pengembangan ke Depan", TEAL, 9);
  const roadmap = [
    "Autentikasi pengguna dan manajemen role (QC Officer, Supervisor, Admin)",
    "Riwayat verifikasi dengan audit trail dan export laporan PDF",
    "Batch processing — verifikasi banyak material sekaligus",
    "Integrasi dengan sistem ERP / LIMS yang sudah ada",
    "Mobile PWA untuk verifikasi langsung di lantai produksi",
  ];
  for (const item of roadmap) {
    top = bullet(ops, top, item, 7.5, CW - 12, LH, TEAL);
  }
  top -= GAP;

  // ── Tech summary box ──
  const tsH = 34;
  boxTop(ops, ML, top, CW, tsH, LGRAY, NAVY);
  textLine(ops, ML + 8, top - 6, "Tech Stack:", 8, true);
  textLine(
    ops,
    ML + 8,
    top - 17,
    "Frontend: SvelteKit + TypeScript  |  Backend: Node.js / Express + TypeScript",
    7.5,
  );
  textLine(
    ops,
    ML + 8,
    top - 27,
    "Azure: Document Intelligence (OCR)  +  OpenAI GPT-4o  +  Blob Storage",
    7.5,
  );

  pageFooter(ops, 3, 3);
  return ops;
}

// ─── Build & write ────────────────────────────────────────────────────────────
const pdf = new PDF();
pdf.addPage(page1());
pdf.addPage(page2());
pdf.addPage(page3());

let outPath = path.join(__dirname, "project-brief.pdf");
try {
  fs.writeFileSync(outPath, pdf.build());
} catch {
  outPath = path.join(__dirname, "project-brief-v3.pdf");
  fs.writeFileSync(outPath, pdf.build());
}
const size = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(
  `✓ ${path.relative(process.cwd(), outPath)}  (${size} KB, 3 halaman)`,
);
