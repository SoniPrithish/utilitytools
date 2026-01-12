# UtilityTools

Fast, free browser-based utility tools for images and PDFs. All processing happens locally in your browser - no uploads to servers, maximum privacy.

## Features

### Image Tools
- **Image Compressor** - Reduce image file size with adjustable quality and max width settings
- **Image Resizer** - Resize images by percentage or exact dimensions
- **Image Format Converter** - Convert between PNG, JPG, and WebP formats with quality control

### PDF Tools
- **Reduce PDF Size** - Compress PDFs with extreme, normal, or low compression levels
- **PDF to Image** - Convert PDF pages to high-quality PNG or JPG images
- **Image to PDF** - Combine multiple images into a single PDF with page size options
- **PDF Merger** - Merge multiple PDF files into one with drag-to-reorder

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Client-side Processing** - All files processed in browser

### Libraries Used
| Tool | Library |
|------|---------|
| Image Compression | `browser-image-compression` |
| PDF to Image | `pdfjs-dist` |
| Image to PDF | `jspdf` |
| PDF Merger | `pdf-lib` |
| ZIP Downloads | `jszip` |

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/SoniPrithish/utilitytools.git

# Navigate to project directory
cd utilitytools

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start
```

## Privacy

All file processing happens **entirely in your browser**. Your files are never uploaded to any server. This ensures:

- Maximum privacy for sensitive documents
- Faster processing (no upload/download time)
- Works offline after initial page load
- No file size limits imposed by servers

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Author

Built by [Prithish Soni](https://github.com/SoniPrithish)
