# UtilityTools — A Prithish Soni Project

UtilityTools is my personal utility suite for fast image and PDF workflows on the web.

Live at **[prithish.me](https://prithish.me)**.

---

## Why this project exists

I wanted a clean, reliable set of tools that are:

- Fast to use
- Private by default
- Simple for anyone to access from a browser

Every core operation runs client-side, so your files stay with you.

---

## What you can do

### Image tools
- **Image Compressor** — Reduce image size with adjustable quality and max width
- **Image Resizer** — Resize by percentage or exact dimensions
- **Image Format Converter** — Convert between PNG, JPG, and WebP

### PDF tools
- **Reduce PDF Size** — Compress PDFs with multiple compression levels
- **PDF to Image** — Convert PDF pages to PNG or JPG
- **Image to PDF** — Combine images into a single PDF
- **PDF Merger** — Merge PDFs with drag-and-drop ordering

---

## Tech stack

- **Next.js**
- **TypeScript**
- **Tailwind CSS**
- **Client-side file processing**

### Core libraries
| Capability | Library |
|------------|---------|
| Image Compression | `browser-image-compression` |
| PDF to Image | `pdfjs-dist` |
| Image to PDF | `jspdf` |
| PDF Merger | `pdf-lib` |
| ZIP Downloads | `jszip` |

---

## Local development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
git clone https://github.com/SoniPrithish/utilitytools.git
cd utilitytools
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production
```bash
npm run build
npm run start
```

---

## Privacy

Files are processed in your browser and are not uploaded to a backend for conversion.

---

## License

MIT

---

Built by [Prithish Soni](https://github.com/SoniPrithish)
