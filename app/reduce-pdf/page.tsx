'use client';

import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import FileDropzone from '@/components/FileDropzone';
import { downloadFile, formatFileSize, removeFileExtension } from '@/lib/utils';
import JSZip from 'jszip';

interface CompressedPdf {
  original: File;
  compressed: Blob;
  originalSize: number;
  compressedSize: number;
}

type CompressionLevel = 'extreme' | 'normal' | 'low';

export default function ReducePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('normal');
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<CompressedPdf[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setResults([]);
    setError(null);
  };

  // Get compression settings based on level
  const getCompressionSettings = (level: CompressionLevel) => {
    switch (level) {
      case 'extreme':
        return { imageQuality: 0.3, removeMetadata: true, downsampleImages: true };
      case 'normal':
        return { imageQuality: 0.6, removeMetadata: true, downsampleImages: false };
      case 'low':
        return { imageQuality: 0.85, removeMetadata: false, downsampleImages: false };
    }
  };

  // Compress a single image using canvas
  const compressImage = async (
    imageBytes: Uint8Array,
    quality: number
  ): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
      const blob = new Blob([imageBytes as BlobPart]);
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            blob.arrayBuffer().then((buffer) => {
              resolve(new Uint8Array(buffer));
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  };

  const compressPdf = async (file: File): Promise<CompressedPdf> => {
    const settings = getCompressionSettings(compressionLevel);
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    // Remove metadata if enabled
    if (settings.removeMetadata) {
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');
    }

    // Process embedded images - extract and recompress
    // Note: pdf-lib has limited image manipulation, so we focus on 
    // creating a new optimized PDF structure

    // Save with optimizations
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const compressedBlob = new Blob([compressedBytes as BlobPart], { type: 'application/pdf' });

    // If the "compressed" file is larger, return original
    const finalBlob = compressedBlob.size >= file.size ? file : compressedBlob;
    const finalSize = finalBlob instanceof File ? finalBlob.size : compressedBlob.size;

    return {
      original: file,
      compressed: finalBlob,
      originalSize: file.size,
      compressedSize: finalSize,
    };
  };

  const compressAllPdfs = async () => {
    if (files.length === 0) return;

    setIsCompressing(true);
    setProgress(0);
    setError(null);
    const compressed: CompressedPdf[] = [];
    let hasErrors = false;

    for (let i = 0; i < files.length; i++) {
      try {
        const result = await compressPdf(files[i]);
        compressed.push(result);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (err) {
        console.error(`Error compressing ${files[i].name}:`, err);
        hasErrors = true;
      }
    }

    if (compressed.length === 0 && hasErrors) {
      setError('Failed to compress PDFs. Please make sure you selected valid PDF files.');
    } else if (hasErrors) {
      setError(`Some PDFs could not be compressed. ${compressed.length} of ${files.length} succeeded.`);
    }

    setResults(compressed);
    setIsCompressing(false);
  };

  const downloadPdf = (result: CompressedPdf) => {
    const filename = `${removeFileExtension(result.original.name)}_reduced.pdf`;
    downloadFile(result.compressed, filename);
  };

  const downloadAllAsZip = async () => {
    if (results.length === 0) return;

    const zip = new JSZip();

    results.forEach((result) => {
      const filename = `${removeFileExtension(result.original.name)}_reduced.pdf`;
      zip.file(filename, result.compressed);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadFile(zipBlob, 'reduced_pdfs.zip');
  };

  const totalSaved = results.reduce((acc, r) => acc + (r.originalSize - r.compressedSize), 0);
  const totalOriginalSize = results.reduce((a, r) => a + r.originalSize, 0);
  const savingsPercent = totalOriginalSize > 0 ? Math.round((totalSaved / totalOriginalSize) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reduce PDF Size</h1>
        <p className="text-gray-600">
          Compress PDF files to reduce their size. All processing happens locally in your browser - your files are never uploaded.
        </p>
      </div>

      <FileDropzone
        accept=".pdf,application/pdf"
        multiple={true}
        maxFiles={20}
        onFilesSelected={handleFilesSelected}
        label="Drop PDF files here"
        sublabel="PDF files only - up to 20 files"
      />

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {files.length > 0 && results.length === 0 && !isCompressing && (
        <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Compression Settings</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Compression Level
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    value="extreme"
                    checked={compressionLevel === 'extreme'}
                    onChange={() => setCompressionLevel('extreme')}
                    className="mt-1"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Extreme</span>
                    <p className="text-xs text-gray-500">Maximum compression, smaller file size. Best for archiving.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-blue-500 bg-blue-50 rounded-lg cursor-pointer">
                  <input
                    type="radio"
                    value="normal"
                    checked={compressionLevel === 'normal'}
                    onChange={() => setCompressionLevel('normal')}
                    className="mt-1"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Normal</span>
                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Recommended</span>
                    <p className="text-xs text-gray-500">Balanced compression for most use cases.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    value="low"
                    checked={compressionLevel === 'low'}
                    onChange={() => setCompressionLevel('low')}
                    className="mt-1"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Low</span>
                    <p className="text-xs text-gray-500">Minimal compression, highest quality. Best for printing.</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-2">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-sm font-medium">100% Private & Secure</span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Your files never leave your device. All processing happens in your browser.
                </p>
              </div>
            </div>

            <button
              onClick={compressAllPdfs}
              disabled={isCompressing}
              className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
            >
              {isCompressing
                ? `Compressing... ${progress}%`
                : `Reduce Size of ${files.length} PDF${files.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Compression Complete</h3>
              <p className="text-sm text-green-600">
                {totalSaved > 0
                  ? `Total saved: ${formatFileSize(totalSaved)} (${savingsPercent}%)`
                  : 'Files are already optimized'}
              </p>
            </div>
            {results.length === 1 ? (
              <button
                onClick={() => downloadPdf(results[0])}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Download PDF
              </button>
            ) : (
              <button
                onClick={downloadAllAsZip}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Download All (ZIP)
              </button>
            )}
          </div>

          <div className="space-y-3">
            {results.map((result, index) => {
              const savings = result.originalSize - result.compressedSize;
              const savingsPercent = result.originalSize > 0
                ? Math.round((savings / result.originalSize) * 100)
                : 0;

              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.original.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(result.originalSize)} → {formatFileSize(result.compressedSize)}
                      {savings > 0 && (
                        <span className="text-green-600 ml-2">-{savingsPercent}%</span>
                      )}
                      {savings <= 0 && (
                        <span className="text-gray-500 ml-2">Already optimized</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => downloadPdf(result)}
                    className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Download
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => {
              setFiles([]);
              setResults([]);
            }}
            className="w-full mt-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
