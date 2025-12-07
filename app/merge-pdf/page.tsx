'use client';

import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import FileDropzone from '@/components/FileDropzone';
import { downloadFile, formatFileSize } from '@/lib/utils';

interface PdfFile {
  id: string;
  file: File;
  pageCount: number;
}

export default function MergePdfPage() {
  const [pdfs, setPdfs] = useState<PdfFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    setIsLoading(true);
    setError(null);
    const newPdfs: PdfFile[] = [];
    let failedCount = 0;

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        
        newPdfs.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          pageCount: pdf.getPageCount(),
        });
      } catch (err) {
        console.error(`Error loading ${file.name}:`, err);
        failedCount++;
      }
    }

    if (failedCount > 0 && newPdfs.length === 0) {
      setError('Failed to load PDFs. Please make sure you selected valid PDF files.');
    } else if (failedCount > 0) {
      setError(`${failedCount} file(s) could not be loaded.`);
    }

    setPdfs((prev) => [...prev, ...newPdfs]);
    setIsLoading(false);
  };

  const removePdf = (id: string) => {
    setPdfs((prev) => prev.filter((pdf) => pdf.id !== id));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newPdfs = [...pdfs];
    const draggedPdf = newPdfs[draggedIndex];
    newPdfs.splice(draggedIndex, 1);
    newPdfs.splice(index, 0, draggedPdf);
    setPdfs(newPdfs);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const mergePdfs = async () => {
    if (pdfs.length < 2) return;

    setIsMerging(true);
    setError(null);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const pdfFile of pdfs) {
        const arrayBuffer = await pdfFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes as BlobPart], { type: 'application/pdf' });
      downloadFile(blob, 'merged.pdf');
    } catch (err) {
      console.error('Error merging PDFs:', err);
      setError('Failed to merge PDFs. Please try again.');
    }

    setIsMerging(false);
  };

  const totalPages = pdfs.reduce((acc, pdf) => acc + pdf.pageCount, 0);
  const totalSize = pdfs.reduce((acc, pdf) => acc + pdf.file.size, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Merge PDFs</h1>
        <p className="text-gray-600">
          Combine multiple PDF files into one. Drag to reorder.
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

      {isLoading && (
        <div className="mt-6 text-center text-gray-600">
          Loading PDFs...
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {pdfs.length > 0 && (
        <>
          <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {pdfs.length} PDF{pdfs.length > 1 ? 's' : ''} Selected
                </h3>
                <p className="text-sm text-gray-500">
                  {totalPages} total pages • {formatFileSize(totalSize)}
                </p>
              </div>
              <button
                onClick={() => setPdfs([])}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-2">
              {pdfs.map((pdf, index) => (
                <div
                  key={pdf.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-move transition-colors ${
                    draggedIndex === index
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 bg-gray-200 rounded text-sm font-medium text-gray-600">
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {pdf.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {pdf.pageCount} page{pdf.pageCount > 1 ? 's' : ''} • {formatFileSize(pdf.file.size)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                    
                    <button
                      onClick={() => removePdf(pdf.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-gray-500 text-center">
              Drag items to reorder • Files will be merged in the order shown
            </p>
          </div>

          <button
            onClick={mergePdfs}
            disabled={pdfs.length < 2 || isMerging}
            className="w-full mt-6 py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
          >
            {isMerging
              ? 'Merging...'
              : pdfs.length < 2
              ? 'Add at least 2 PDFs to merge'
              : `Merge ${pdfs.length} PDFs`}
          </button>
        </>
      )}
    </div>
  );
}

