'use client';

import { useState } from 'react';
import FileDropzone from '@/components/FileDropzone';
import { downloadFile, removeFileExtension, formatFileSize } from '@/lib/utils';
import JSZip from 'jszip';

interface ConvertedImage {
  original: File;
  converted: Blob;
  dataUrl: string;
}

type OutputFormat = 'png' | 'jpeg' | 'webp';

export default function ConvertImagePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png');
  const [quality, setQuality] = useState(0.92);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ConvertedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setResults([]);
    setError(null);
  };

  const convertImages = async () => {
    if (files.length === 0) return;

    setIsConverting(true);
    setProgress(0);
    setError(null);
    const converted: ConvertedImage[] = [];
    let hasErrors = false;

    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];
        const result = await convertImage(file, outputFormat, quality);
        converted.push(result);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (err) {
        console.error(`Error converting ${files[i].name}:`, err);
        hasErrors = true;
      }
    }

    if (converted.length === 0 && hasErrors) {
      setError('Failed to convert images. Please make sure you selected valid image files.');
    } else if (hasErrors) {
      setError(`Some images could not be converted. ${converted.length} of ${files.length} succeeded.`);
    }

    setResults(converted);
    setIsConverting(false);
  };

  const convertImage = (
    file: File,
    format: OutputFormat,
    quality: number
  ): Promise<ConvertedImage> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d')!;
          
          // For JPEG, fill with white background (no transparency)
          if (format === 'jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          ctx.drawImage(img, 0, 0);
          
          const mimeType = `image/${format}`;
          const dataUrl = canvas.toDataURL(mimeType, quality);
          
          // Convert data URL to blob
          fetch(dataUrl)
            .then((res) => res.blob())
            .then((blob) => {
              // Keep original if converted is larger (unless format changed)
              const originalExt = file.name.split('.').pop()?.toLowerCase();
              const targetExt = format === 'jpeg' ? 'jpg' : format;
              const formatChanged = originalExt !== targetExt && originalExt !== format;
              
              const finalBlob = (blob.size > file.size && !formatChanged) ? file : blob;
              const finalDataUrl = (blob.size > file.size && !formatChanged) ? e.target?.result as string : dataUrl;
              
              resolve({
                original: file,
                converted: finalBlob,
                dataUrl: finalDataUrl,
              });
            })
            .catch(reject);
        };
        
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const getExtension = (format: OutputFormat): string => {
    return format === 'jpeg' ? 'jpg' : format;
  };

  const downloadImage = (result: ConvertedImage) => {
    const extension = getExtension(outputFormat);
    const filename = `${removeFileExtension(result.original.name)}.${extension}`;
    downloadFile(result.converted, filename);
  };

  const downloadAllAsZip = async () => {
    if (results.length === 0) return;

    const zip = new JSZip();
    const extension = getExtension(outputFormat);

    results.forEach((result) => {
      const filename = `${removeFileExtension(result.original.name)}.${extension}`;
      zip.file(filename, result.converted);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadFile(zipBlob, `converted_images.zip`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Convert Image Format</h1>
        <p className="text-gray-600">
          Convert images between PNG, JPG, and WebP formats.
        </p>
      </div>

      <FileDropzone
        accept="image/*"
        multiple={true}
        maxFiles={20}
        onFilesSelected={handleFilesSelected}
        label="Drop images here"
        sublabel="PNG, JPG, WebP, GIF, BMP - up to 20 files"
      />

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {files.length > 0 && results.length === 0 && !isConverting && (
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
                    checked={outputFormat === 'png'}
                    onChange={() => setOutputFormat('png')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">PNG (Lossless)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="jpeg"
                    checked={outputFormat === 'jpeg'}
                    onChange={() => setOutputFormat('jpeg')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">JPG</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="webp"
                    checked={outputFormat === 'webp'}
                    onChange={() => setOutputFormat('webp')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">WebP</span>
                </label>
              </div>
            </div>

            {outputFormat !== 'png' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quality: {Math.round(quality * 100)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Smaller file</span>
                  <span>Better quality</span>
                </div>
              </div>
            )}

            <button
              onClick={convertImages}
              disabled={isConverting}
              className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
            >
              {isConverting
                ? `Converting... ${progress}%`
                : `Convert ${files.length} Image${files.length > 1 ? 's' : ''} to ${outputFormat.toUpperCase()}`}
            </button>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Conversion Complete</h3>
              <p className="text-sm text-gray-600">
                {results.length} image{results.length > 1 ? 's' : ''} converted to {outputFormat.toUpperCase()}
              </p>
            </div>
            <div className="flex gap-2">
              {results.length === 1 && (
                <button
                  onClick={() => downloadImage(results[0])}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Download Image
                </button>
              )}
              {results.length > 1 && (
                <button
                  onClick={downloadAllAsZip}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Download ZIP
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {results.map((result, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img
                    src={result.dataUrl}
                    alt={result.original.name}
                    className="w-10 h-10 object-cover rounded"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {removeFileExtension(result.original.name)}.{getExtension(outputFormat)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(result.original.size)} → {formatFileSize(result.converted.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => downloadImage(result)}
                  className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Download
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setFiles([]);
              setResults([]);
            }}
            className="w-full mt-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Start over
          </button>
        </div>
      )}
    </div>
  );
}

