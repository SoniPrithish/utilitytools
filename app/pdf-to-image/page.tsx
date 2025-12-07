'use client';

import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import FileDropzone from '@/components/FileDropzone';
import { downloadFile, removeFileExtension } from '@/lib/utils';
import JSZip from 'jszip';

// Set worker path
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface ConvertedPage {
  pageNumber: number;
  dataUrl: string;
  blob: Blob;
}

export default function PdfToImagePage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [scale, setScale] = useState(2);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pages, setPages] = useState<ConvertedPage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setPages([]);
      setError(null);
    }
  };

  const convertPdfToImages = async () => {
    if (!file) return;

    setIsConverting(true);
    setProgress(0);
    setPages([]);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      const convertedPages: ConvertedPage[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const quality = format === 'jpeg' ? 0.92 : undefined;
        const dataUrl = canvas.toDataURL(mimeType, quality);

        // Convert data URL to blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        convertedPages.push({
          pageNumber: i,
          dataUrl,
          blob,
        });

        setProgress(Math.round((i / numPages) * 100));
      }

      setPages(convertedPages);
    } catch (err) {
      console.error('Error converting PDF:', err);
      setError('Failed to convert PDF. Please make sure the file is a valid PDF.');
    }

    setIsConverting(false);
  };

  const downloadPage = (page: ConvertedPage) => {
    const baseName = file ? removeFileExtension(file.name) : 'page';
    const extension = format === 'png' ? 'png' : 'jpg';
    downloadFile(page.blob, `${baseName}_page${page.pageNumber}.${extension}`);
  };

  const downloadAllAsZip = async () => {
    if (pages.length === 0 || !file) return;

    const zip = new JSZip();
    const baseName = removeFileExtension(file.name);
    const extension = format === 'png' ? 'png' : 'jpg';

    pages.forEach((page) => {
      zip.file(`${baseName}_page${page.pageNumber}.${extension}`, page.blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadFile(zipBlob, `${baseName}_images.zip`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">PDF to Image</h1>
        <p className="text-gray-600">
          Convert PDF pages to high-quality images. All processing happens in your browser.
        </p>
      </div>

      <FileDropzone
        accept=".pdf,application/pdf"
        multiple={false}
        onFilesSelected={handleFilesSelected}
        label="Drop PDF here"
        sublabel="PDF files only"
      />

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {file && pages.length === 0 && !error && (
        <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Conversion Settings</h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Output Format
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="png"
                    checked={format === 'png'}
                    onChange={() => setFormat('png')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">PNG (Lossless)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="jpeg"
                    checked={format === 'jpeg'}
                    onChange={() => setFormat('jpeg')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">JPG (Smaller)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quality: {scale}x
              </label>
              <input
                type="range"
                min="1"
                max="4"
                step="0.5"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Standard (1x)</span>
                <span>High Quality (4x)</span>
              </div>
            </div>

            <button
              onClick={convertPdfToImages}
              disabled={isConverting}
              className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
            >
              {isConverting ? `Converting... ${progress}%` : 'Convert to Images'}
            </button>
          </div>
        </div>
      )}

      {pages.length > 0 && (
        <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Conversion Complete</h3>
              <p className="text-sm text-gray-600">{pages.length} pages converted</p>
            </div>
            <button
              onClick={downloadAllAsZip}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Download ZIP
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {pages.map((page) => (
              <div
                key={page.pageNumber}
                className="relative group border border-gray-200 rounded-lg overflow-hidden"
              >
                <img
                  src={page.dataUrl}
                  alt={`Page ${page.pageNumber}`}
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => downloadPage(page)}
                    className="px-3 py-1.5 bg-white text-gray-900 text-sm font-medium rounded-lg"
                  >
                    Download
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                  Page {page.pageNumber}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setFile(null);
              setPages([]);
            }}
            className="w-full mt-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Convert another PDF
          </button>
        </div>
      )}
    </div>
  );
}

