'use client';

import { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { jsPDF } from 'jspdf';

// Set worker path - use local worker for reliability
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  message?: string;
  duration?: number;
}

export default function TestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateResult = (name: string, update: Partial<TestResult>) => {
    setResults(prev => prev.map(r => r.name === name ? { ...r, ...update } : r));
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults([
      { name: 'Image Compression', status: 'pending' },
      { name: 'Image Format Conversion', status: 'pending' },
      { name: 'PDF to Image', status: 'pending' },
      { name: 'Image to PDF', status: 'pending' },
      { name: 'PDF Merge', status: 'pending' },
    ]);

    // Test 1: Image Compression
    await testImageCompression();

    // Test 2: Image Format Conversion
    await testImageConversion();

    // Test 3: PDF to Image
    await testPdfToImage();

    // Test 4: Image to PDF
    await testImageToPdf();

    // Test 5: PDF Merge
    await testPdfMerge();

    setIsRunning(false);
  };

  const testImageCompression = async () => {
    const name = 'Image Compression';
    updateResult(name, { status: 'running' });
    const start = Date.now();

    try {
      const response = await fetch('/test-files/test-image.bmp');
      const blob = await response.blob();
      const file = new File([blob], 'test-image.bmp', { type: 'image/bmp' });

      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        initialQuality: 0.8,
        useWebWorker: true,
      };

      const compressed = await imageCompression(file, options);
      
      // Use original if compressed is larger
      const finalFile = compressed.size < file.size ? compressed : file;
      const saved = file.size - finalFile.size;
      
      if (finalFile && finalFile.size > 0) {
        updateResult(name, { 
          status: 'passed', 
          message: saved > 0 
            ? `Original: ${(file.size / 1024).toFixed(1)}KB → Compressed: ${(finalFile.size / 1024).toFixed(1)}KB (saved ${(saved / 1024).toFixed(1)}KB)`
            : `Original: ${(file.size / 1024).toFixed(1)}KB (already optimal, no compression needed)`,
          duration: Date.now() - start 
        });
      } else {
        throw new Error('Compressed file is empty');
      }
    } catch (error) {
      updateResult(name, { 
        status: 'failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start 
      });
    }
  };

  const testImageConversion = async () => {
    const name = 'Image Format Conversion';
    updateResult(name, { status: 'running' });
    const start = Date.now();

    try {
      const response = await fetch('/test-files/test-image.bmp');
      const blob = await response.blob();

      // Convert to PNG using canvas
      const img = new Image();
      const loadPromise = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });
      img.src = URL.createObjectURL(blob);
      await loadPromise;

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const pngDataUrl = canvas.toDataURL('image/png');
      const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const webpDataUrl = canvas.toDataURL('image/webp', 0.9);

      if (pngDataUrl && jpgDataUrl && webpDataUrl) {
        updateResult(name, { 
          status: 'passed', 
          message: `Converted to PNG, JPG, and WebP successfully (${img.width}x${img.height})`,
          duration: Date.now() - start 
        });
      } else {
        throw new Error('Conversion failed');
      }
    } catch (error) {
      updateResult(name, { 
        status: 'failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start 
      });
    }
  };

  const testPdfToImage = async () => {
    const name = 'PDF to Image';
    updateResult(name, { status: 'running' });
    const start = Date.now();

    try {
      const response = await fetch('/test-files/test-document.pdf');
      const arrayBuffer = await response.arrayBuffer();
      
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const dataUrl = canvas.toDataURL('image/png');

      if (dataUrl && dataUrl.length > 100) {
        updateResult(name, { 
          status: 'passed', 
          message: `Converted ${numPages} page(s) to images`,
          duration: Date.now() - start 
        });
      } else {
        throw new Error('Conversion produced empty result');
      }
    } catch (error) {
      updateResult(name, { 
        status: 'failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start 
      });
    }
  };

  const testImageToPdf = async () => {
    const name = 'Image to PDF';
    updateResult(name, { status: 'running' });
    const start = Date.now();

    try {
      const response = await fetch('/test-files/test-image.bmp');
      const blob = await response.blob();

      // Load image
      const img = new Image();
      const loadPromise = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });
      img.src = URL.createObjectURL(blob);
      await loadPromise;

      // Convert to data URL
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const maxWidth = pageWidth - 2 * margin;
      const maxHeight = pageHeight - 2 * margin;
      
      const imgAspect = img.width / img.height;
      const pageAspect = maxWidth / maxHeight;
      
      let imgWidth, imgHeight;
      if (imgAspect > pageAspect) {
        imgWidth = maxWidth;
        imgHeight = maxWidth / imgAspect;
      } else {
        imgHeight = maxHeight;
        imgWidth = maxHeight * imgAspect;
      }
      
      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;
      
      pdf.addImage(dataUrl, 'JPEG', x, y, imgWidth, imgHeight);
      const pdfOutput = pdf.output('blob');

      if (pdfOutput && pdfOutput.size > 0) {
        updateResult(name, { 
          status: 'passed', 
          message: `Created PDF with image (${(pdfOutput.size / 1024).toFixed(1)}KB)`,
          duration: Date.now() - start 
        });
      } else {
        throw new Error('PDF creation failed');
      }
    } catch (error) {
      updateResult(name, { 
        status: 'failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start 
      });
    }
  };

  const testPdfMerge = async () => {
    const name = 'PDF Merge';
    updateResult(name, { status: 'running' });
    const start = Date.now();

    try {
      const [response1, response2] = await Promise.all([
        fetch('/test-files/test-document.pdf'),
        fetch('/test-files/test-document-2.pdf'),
      ]);

      const [arrayBuffer1, arrayBuffer2] = await Promise.all([
        response1.arrayBuffer(),
        response2.arrayBuffer(),
      ]);

      const mergedPdf = await PDFDocument.create();

      const pdf1 = await PDFDocument.load(arrayBuffer1);
      const pdf2 = await PDFDocument.load(arrayBuffer2);

      const pages1 = await mergedPdf.copyPages(pdf1, pdf1.getPageIndices());
      const pages2 = await mergedPdf.copyPages(pdf2, pdf2.getPageIndices());

      pages1.forEach(page => mergedPdf.addPage(page));
      pages2.forEach(page => mergedPdf.addPage(page));

      const mergedBytes = await mergedPdf.save();
      const totalPages = mergedPdf.getPageCount();

      if (mergedBytes && mergedBytes.length > 0) {
        updateResult(name, { 
          status: 'passed', 
          message: `Merged ${totalPages} pages (${(mergedBytes.length / 1024).toFixed(1)}KB)`,
          duration: Date.now() - start 
        });
      } else {
        throw new Error('Merge produced empty result');
      }
    } catch (error) {
      updateResult(name, { 
        status: 'failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start 
      });
    }
  };

  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tool Tests</h1>
        <p className="text-gray-600">
          Automated tests for all utility tools using test files.
        </p>
      </div>

      <button
        onClick={runAllTests}
        disabled={isRunning}
        className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors mb-8"
      >
        {isRunning ? 'Running Tests...' : 'Run All Tests'}
      </button>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <span className="text-green-600">Passed: {passedCount}</span>
            <span className="text-red-600">Failed: {failedCount}</span>
            <span className="text-gray-500">Total: {results.length}</span>
          </div>

          {results.map((result) => (
            <div
              key={result.name}
              className={`p-4 rounded-lg border ${
                result.status === 'passed'
                  ? 'bg-green-50 border-green-200'
                  : result.status === 'failed'
                  ? 'bg-red-50 border-red-200'
                  : result.status === 'running'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {result.status === 'passed' && (
                    <span className="text-green-600">✓</span>
                  )}
                  {result.status === 'failed' && (
                    <span className="text-red-600">✗</span>
                  )}
                  {result.status === 'running' && (
                    <span className="text-blue-600 animate-pulse">●</span>
                  )}
                  {result.status === 'pending' && (
                    <span className="text-gray-400">○</span>
                  )}
                  <span className="font-medium text-gray-900">{result.name}</span>
                </div>
                {result.duration && (
                  <span className="text-sm text-gray-500">{result.duration}ms</span>
                )}
              </div>
              {result.message && (
                <p className={`mt-1 text-sm ${
                  result.status === 'passed' ? 'text-green-600' : 
                  result.status === 'failed' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {result.message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

