# Medify AI

Aplikasi verifikasi material farmasi berbasis AI. Medify AI membantu pengguna mendeteksi ketidaksesuaian data antara label fisik kemasan dan dokumen pendukung (seperti Certificate of Analysis) secara otomatis — tanpa input manual.

Sistem mengekstraksi data dari gambar label dan dokumen PDF menggunakan OCR, membandingkan field-field kritis, menentukan tingkat risiko, dan menghasilkan penjelasan berbasis AI dalam Bahasa Indonesia.

---

## Fitur Utama

- Upload gambar label (JPG, PNG, WEBP) dan dokumen pendukung (PDF) melalui antarmuka web
- Ekstraksi data otomatis via Azure Document Intelligence (OCR) — nama material, nomor batch, tanggal kedaluwarsa
- Validasi dan deteksi mismatch antar field kritis dari dua sumber dokumen
- Penilaian risiko otomatis: HIGH, MEDIUM, atau LOW berdasarkan jenis perbedaan yang ditemukan
- Penjelasan hasil verifikasi dalam Bahasa Indonesia yang dihasilkan oleh Azure OpenAI (GPT-4o)
- Tampilan hasil lengkap dengan highlight visual pada field yang tidak sesuai
- Penanganan error granular dengan kode error spesifik dan pesan yang informatif
- Fallback graceful: hasil tetap ditampilkan meskipun layanan AI tidak tersedia

---

## Teknologi yang Digunakan

**Frontend**

- SvelteKit 2 dengan Svelte 5
- TypeScript
- Vite

**Backend**

- Node.js dengan Express 4
- TypeScript
- Multer (file upload handling)
- Vitest (unit testing)

**Azure Services**

- Azure Document Intelligence — ekstraksi teks dari gambar dan PDF
- Azure OpenAI (GPT-4o) — generasi penjelasan hasil verifikasi
- Azure Blob Storage — penyimpanan file sementara selama proses OCR

---

## Struktur Folder

```
medify-ai/
├── backend/
│   ├── src/
│   │   ├── core/
│   │   │   ├── validator.ts          # Logika perbandingan field antar dokumen
│   │   │   ├── validator.test.ts
│   │   │   ├── riskScorer.ts         # Penentuan tingkat risiko
│   │   │   └── riskScorer.test.ts
│   │   ├── routes/
│   │   │   └── verify.ts             # POST /api/verify — endpoint utama
│   │   ├── services/
│   │   │   ├── ocrService.ts         # Integrasi Azure Document Intelligence
│   │   │   ├── ocrService.test.ts
│   │   │   ├── aiService.ts          # Integrasi Azure OpenAI
│   │   │   └── blobService.ts        # Upload & delete Azure Blob Storage
│   │   ├── types.ts                  # Shared TypeScript interfaces
│   │   └── index.ts                  # Entry point Express
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── components/
│   │   │   │   ├── UploadForm.svelte       # Form upload file
│   │   │   │   ├── ResultCard.svelte       # Tampilan status dan risk level
│   │   │   │   ├── FieldComparison.svelte  # Tabel perbandingan field
│   │   │   │   ├── LoadingIndicator.svelte
│   │   │   │   └── ErrorDisplay.svelte
│   │   │   ├── api.ts                # Fungsi fetch ke backend
│   │   │   ├── store.ts              # Svelte store (isLoading, result, error)
│   │   │   └── types.ts              # TypeScript types (mirror dari backend)
│   │   ├── routes/
│   │   │   └── +page.svelte          # Halaman utama
│   │   └── app.html
│   ├── package.json
│   └── svelte.config.js
│
├── test-data/                        # Skenario pengujian (valid & mismatch)
└── readme/                           # Dokumen brief proyek
```

---

## Instalasi dan Menjalankan Proyek

### Prasyarat

- Node.js 18 atau lebih baru
- Akun Microsoft Azure dengan layanan berikut yang sudah aktif:
  - Azure Document Intelligence
  - Azure OpenAI (dengan deployment model GPT-4o)
  - Azure Blob Storage (dengan container bernama `uploads`)

### 1. Clone Repositori

```bash
git clone <repository-url>
cd medify-ai
```

### 2. Konfigurasi Backend

```bash
cd backend
cp .env.example .env
```

Isi file `.env` dengan kredensial Azure Anda:

```env
# Azure Document Intelligence
AZURE_DOC_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOC_INTELLIGENCE_KEY=your_key_here

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your_key_here
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
AZURE_STORAGE_CONTAINER_NAME=uploads

# Server
PORT=3001
FRONTEND_URL=http://localhost:5173
```

Install dependensi dan jalankan backend:

```bash
npm install
npm run dev
```

Backend akan berjalan di `http://localhost:3001`.

### 3. Konfigurasi Frontend

Buka terminal baru:

```bash
cd frontend
npm install
npm run dev
```

Frontend akan berjalan di `http://localhost:5173`.

### 4. Menjalankan Unit Test

```bash
cd backend
npm test
```

### 5. Build untuk Produksi

**Backend:**

```bash
cd backend
npm run build
npm start
```

**Frontend:**

```bash
cd frontend
npm run build
npm run preview
```

---

## API

### POST /api/verify

Endpoint utama untuk menjalankan proses verifikasi.

**Request:** `multipart/form-data`

| Field      | Tipe | Wajib | Keterangan                              |
| ---------- | ---- | ----- | --------------------------------------- |
| `label`    | File | Ya    | Gambar label (JPG/PNG/WEBP, maks 10 MB) |
| `document` | File | Ya    | Dokumen pendukung (PDF, maks 20 MB)     |

**Response sukses (200):**

```json
{
  "success": true,
  "status": "MISMATCH",
  "riskLevel": "HIGH",
  "fields": [
    {
      "fieldName": "batchNumber",
      "labelValue": "BT-2024-001",
      "documentValue": "BT-2024-002",
      "isMismatch": true,
      "mismatchType": "value_mismatch"
    }
  ],
  "explanation": "Ditemukan perbedaan pada batch number...",
  "extractedLabel": { ... },
  "extractedDocument": { ... }
}
```

**Response error (400/500):**

```json
{
  "success": false,
  "error": "File label wajib diunggah sebelum memulai verifikasi.",
  "code": "MISSING_LABEL"
}
```

### GET /api/health

Health check endpoint. Mengembalikan status server dan timestamp.

---

## Catatan Arsitektur

- Tidak ada database. Hasil verifikasi dikembalikan langsung sebagai JSON response dan tidak disimpan.
- File yang diunggah disimpan sementara di Azure Blob Storage hanya selama proses OCR berlangsung, kemudian dihapus otomatis di blok `finally`.
- AI explanation bersifat opsional. Jika Azure OpenAI tidak tersedia atau timeout, hasil validasi tetap dikembalikan dengan pesan fallback.
- Tidak ada autentikasi pada versi ini. Fitur tersebut berada di luar scope MVP.
