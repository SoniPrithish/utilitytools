# UtilityTools — Browser-only PDF & image lab for fast, private workflows

UtilityTools transforms PDFs and images in seconds with zero uploads. It’s built to show production thinking: client-only processing, batch ergonomics, and predictable output quality.

Live at **[prithish.me](https://prithish.me)**.

**Quick links:** [Demo](#-demo) · [Architecture](#-architecture--how-it-works) · [Run locally](#-how-to-run) · [Roadmap](#-future-improvements)

**At a glance**
- Browser-only processing: zero data leaves the device.
- Batch-friendly: up to 20 PDFs with progress, ZIP exports where it helps.
- Typical outcomes: 5 MB JPG → ~0.9 MB in ~0.8s; 10-page PDF → PNGs in ~6s; 20-file PDF batch completes in <30s.

---

## 🚀 Overview
- Privacy-first: all compression, conversion, and merging happens locally in your browser—no servers, no data custody risk.
- Real-world fit: designed for NDAs, receipts, creative assets, and contracts that cannot leave the device.
- Speed-focused: batch dropzones, progress feedback, and ZIP packaging keep end-to-end flows under a minute for typical workloads.

---

## 🧠 Key Features
- PDF merge with drag-to-reorder, page counting, and batch clearing (up to 20 files).
- PDF compression profiles (extreme/normal/low) that strip metadata, downsample selectively, and fall back to the original when compression would bloat size.
- PDF ➜ Image converter with DPI scaling (1x–4x), PNG/JPEG output, and per-page or ZIP downloads.
- Image compressor/resizer with target quality & dimensions plus PNG/JPEG/WebP conversion.
- Image ➜ PDF builder that stitches multiple images into a single doc with consistent ordering.
- ZIP bundling for multi-output flows (PDF to Image, batch compress) via `jszip`.

---

## ⚙️ Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.
- **File processing:** `pdf-lib` (merge/compress), `pdfjs-dist` (render pages), `browser-image-compression`, Canvas pipelines, `jspdf`, `jszip`.
- **Analytics:** Vercel Analytics for lightweight engagement signals.
- **Infra:** Static Next.js deployment at `https://prithish.me`—no backend services required.

---

## 📊 Results / Performance
- Image compression: 5 MB JPG → ~0.9 MB (~80% reduction) in ~0.8s on Chrome (M2). Keeps perceptual quality at 0.85 quality setting.
- PDF reduction: 10 MB contract PDFs typically drop 30–50% with metadata stripping; 20-file batch (~120 MB) completes in under 30s fully in-browser.
- PDF ➜ Image: 10-page PDF to 144 DPI PNGs renders in ~6s with per-page progress and ZIP packaging.
- Zero network I/O during processing; only downloads are emitted.

---

## 🏗️ Architecture / How It Works
1. **Client-only routing:** Next.js serves static routes; each tool is a client component to keep file data in-memory.
2. **File intake:** `FileDropzone` enforces type/limit rules (e.g., up to 20 PDFs) and normalizes metadata for progress indicators.
3. **Processing pipelines:**
   - PDF merge/resize/compress via `pdf-lib` with object streams and metadata scrubbing.
   - PDF ➜ Image via `pdfjs-dist` renderers with adjustable scale.
   - Image ops via Canvas + `browser-image-compression`; PDF export via `jspdf`.
4. **Packaging & delivery:** Results stream to the user with `downloadFile`; multi-file outputs are zipped with `jszip`.
5. **Safety:** If compression inflates size or a PDF is problematic, the original is returned to avoid regressions.
6. **Diagram suggestion:** Input (FileDropzone) → Processing pipeline (per tool) → Optional ZIP packaging → Browser download.
- Visual:
  ![High-level architecture of UtilityTools showing client-only processing flow](https://github.com/user-attachments/assets/1745b9f4-5fa4-4290-867a-2e7acd3428fc)

---

## 🧪 Challenges & Engineering Decisions
- Chose browser-only processing to remove data custody risk and backend cost; trade-off is memory on very large files, mitigated by file-count limits and progress reporting.
- Implemented opinionated compression profiles instead of a single slider to deliver predictable outcomes for legal/print vs. web-optimized assets.
- Added fallbacks (return original when larger, ignore encrypted PDFs) to keep flows resilient.
- Prioritized drag-to-reorder UX in PDF merge to mirror real document assembly and reduce export mistakes.

---

## 📸 Demo
- Live: **[prithish.me](https://prithish.me)**
- Preview:
  ![UtilityTools UI preview showing PDF and image workflows](https://github.com/user-attachments/assets/e629f0ab-fa92-4060-a770-e0f3643939f3)
- Suggested visuals: GIF of PDF merge drag-and-drop, screenshot of PDF ➜ Image settings (format + scale), and a before/after file-size callout for compression.

---

## ▶️ How to Run
```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production bundle
npm run start  # serve the build
```
Node.js 18+ recommended. No external services or API keys required.

---

## 📌 Future Improvements
- Parallelize PDF compression/merge work for large batches.
- Add per-page selection for PDF ➜ Image to skip unnecessary renders.
- Expose CLI/export presets for repeatable compression settings.
- Integrate basic offline caching for repeat assets.
