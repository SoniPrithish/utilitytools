'use client';

import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import FileDropzone from '@/components/FileDropzone';
import { formatFileSize, downloadFile, removeFileExtension } from '@/lib/utils';

interface CompressedImage {
  original: File;
  compressed: Blob;
  originalSize: number;
  compressedSize: number;
}

export default function CompressImagePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(0.8);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<CompressedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setResults([]);
    setError(null);
  };

  const compressImages = async () => {
    if (files.length === 0) return;

    setIsCompressing(true);
    setProgress(0);
    setError(null);
    const compressed: CompressedImage[] = [];

    const options = {
      maxSizeMB: 10,
      maxWidthOrHeight: maxWidth,
      initialQuality: quality,
      useWebWorker: true,
    };

    let hasErrors = false;
    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];
        const compressedFile = await imageCompression(file, options);
        
        // Use original if compressed is larger (can happen with small/simple images)
        const finalFile = compressedFile.size < file.size ? compressedFile : file;
        
        compressed.push({
          original: file,
          compressed: finalFile,
          originalSize: file.size,
          compressedSize: finalFile.size,
        });

        setProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (err) {
        console.error(`Error compressing ${files[i].name}:`, err);
        hasErrors = true;
      }
    }

    if (compressed.length === 0 && hasErrors) {
      setError('Failed to compress images. Please make sure you selected valid image files.');
    } else if (hasErrors) {
      setError(`Some images could not be compressed. ${compressed.length} of ${files.length} succeeded.`);
    }

    setResults(compressed);
    setIsCompressing(false);
  };

  const downloadImage = (result: CompressedImage) => {
    const extension = result.original.name.split('.').pop() || 'jpg';
    const filename = `${removeFileExtension(result.original.name)}_compressed.${extension}`;
    downloadFile(result.compressed, filename);
  };

  const downloadAll = () => {
    results.forEach((result) => {
      downloadImage(result);
    });
  };

  const totalSaved = results.reduce(
    (acc, r) => acc + (r.originalSize - r.compressedSize),
    0
  );
  const totalOriginalSize = results.reduce((a, r) => a + r.originalSize, 0);
  const savingsPercent = totalOriginalSize > 0 ? Math.round((totalSaved / totalOriginalSize) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Image Compressor</h1>
        <p className="text-gray-600">
          Reduce image file size while maintaining quality. All processing happens in your browser.
        </p>
      </div>

      <FileDropzone
        accept="image/*"
        multiple={true}
        maxFiles={20}
        onFilesSelected={handleFilesSelected}
        label="Drop images here"
        sublabel="PNG, JPG, WebP - up to 20 files"
      />

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {files.length > 0 && results.length === 0 && !isCompressing && (
        <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Compression Settings</h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quality: {Math.round(quality * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Smaller file</span>
                <span>Better quality</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Width: {maxWidth}px
              </label>
              <input
                type="range"
                min="480"
                max="3840"
                step="240"
                value={maxWidth}
                onChange={(e) => setMaxWidth(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>480px</span>
                <span>3840px (4K)</span>
              </div>
            </div>

            <button
              onClick={compressImages}
              disabled={isCompressing}
              className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
            >
              {isCompressing ? `Compressing... ${progress}%` : `Compress ${files.length} Image${files.length > 1 ? 's' : ''}`}
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
                Total saved: {formatFileSize(totalSaved)} ({savingsPercent}%)
              </p>
            </div>
            <button
              onClick={downloadAll}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Download All
            </button>
          </div>

          <div className="space-y-3">
            {results.map((result, index) => {
              const savings = result.originalSize - result.compressedSize;
              const savingsPercent = Math.round((savings / result.originalSize) * 100);
              
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
                      <span className="text-green-600 ml-2">-{savingsPercent}%</span>
                    </p>
                  </div>
                  <button
                    onClick={() => downloadImage(result)}
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
            className="w-full mt-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Compress more images
          </button>
        </div>
      )}
    </div>
  );
}

