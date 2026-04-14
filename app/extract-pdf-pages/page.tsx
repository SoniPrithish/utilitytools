'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import FileDropzone from '@/components/FileDropzone';
import { downloadFile, formatFileSize, removeFileExtension } from '@/lib/utils';

type PDFJSLib = typeof import('pdfjs-dist');
type PdfJsDocument = Awaited<ReturnType<PDFJSLib['getDocument']>['promise']>;

interface PerPagePdf {
  pageNumber: number;
  blob: Blob;
}

function parsePageRange(input: string, maxPages: number): { pages: number[]; error: string | null } {
  const trimmed = input.trim();
  if (!trimmed) return { pages: [], error: null };

  const pages = new Set<number>();
  const chunks = trimmed.split(',').map((chunk) => chunk.trim()).filter(Boolean);

  for (const chunk of chunks) {
    if (!/^\d+(\s*-\s*\d+)?$/.test(chunk)) {
      return {
        pages: [],
        error: 'Use valid ranges like 3-4,7,10. Only numbers, commas, and single hyphens are allowed.',
      };
    }

    if (chunk.includes('-')) {
      const [startText, endText] = chunk.split('-').map((part) => part.trim());
      const start = Number.parseInt(startText, 10);
      const end = Number.parseInt(endText, 10);

      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1 || start > end) {
        return { pages: [], error: `Invalid range "${chunk}".` };
      }

      if (end > maxPages) {
        return { pages: [], error: `Page ${end} is out of bounds. This PDF has ${maxPages} pages.` };
      }

      for (let page = start; page <= end; page += 1) pages.add(page);
      continue;
    }

    const page = Number.parseInt(chunk, 10);
    if (!Number.isFinite(page) || page < 1 || page > maxPages) {
      return { pages: [], error: `Page ${chunk} is out of bounds. This PDF has ${maxPages} pages.` };
    }
    pages.add(page);
  }

  return { pages: Array.from(pages).sort((a, b) => a - b), error: null };
}

function serializePageRange(pages: number[]): string {
  if (pages.length === 0) return '';
  const sorted = [...pages].sort((a, b) => a - b);

  const parts: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (let index = 1; index <= sorted.length; index += 1) {
    const current = sorted[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }

    parts.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = current;
    previous = current;
  }

  return parts.join(',');
}

function getCombinedFileName(originalFileName: string, selectedPages: number[]): string {
  const baseName = removeFileExtension(originalFileName);
  const rangeLabel = serializePageRange(selectedPages);

  if (!rangeLabel) return `${baseName}_selected-pages.pdf`;
  if (rangeLabel.includes(',')) return `${baseName}_selected-pages.pdf`;
  return `${baseName}_pages_${rangeLabel}.pdf`;
}

export default function ExtractPdfPagesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [rangeInput, setRangeInput] = useState('');
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [visiblePages, setVisiblePages] = useState<number[]>([]);
  const [renderingPages, setRenderingPages] = useState<number[]>([]);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isDownloadingCombined, setIsDownloadingCombined] = useState(false);
  const [isDownloadingPerPage, setIsDownloadingPerPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const pdfDocRef = useRef<PdfJsDocument | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pageNodesRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const thumbnailsRef = useRef<Record<number, string>>({});
  const renderingPagesRef = useRef<Set<number>>(new Set());

  const pageNumbers = useMemo(() => Array.from({ length: pageCount }, (_, idx) => idx + 1), [pageCount]);
  const canAttemptDownload = selectedPages.length > 0 || rangeInput.trim().length > 0;

  useEffect(() => {
    thumbnailsRef.current = thumbnails;
  }, [thumbnails]);

  const resetAll = useCallback((options?: { keepError?: boolean }) => {
    if (pdfDocRef.current) {
      void pdfDocRef.current.destroy();
      pdfDocRef.current = null;
    }

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    pageNodesRef.current.clear();
    renderingPagesRef.current.clear();
    setFile(null);
    setPageCount(0);
    setSelectedPages([]);
    setRangeInput('');
    setThumbnails({});
    setVisiblePages([]);
    setRenderingPages([]);
    if (!options?.keepError) {
      setError(null);
    }
    setRangeError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (pdfDocRef.current) {
        void pdfDocRef.current.destroy();
      }

      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const nextVisible: number[] = [];

        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const pageText = entry.target.getAttribute('data-page-number');
          if (!pageText) return;

          const page = Number.parseInt(pageText, 10);
          if (Number.isFinite(page)) nextVisible.push(page);
        });

        if (nextVisible.length > 0) {
          setVisiblePages((prev) => {
            const merged = new Set(prev);
            nextVisible.forEach((page) => merged.add(page));
            return Array.from(merged);
          });
        }
      },
      { rootMargin: '280px 0px' }
    );

    pageNodesRef.current.forEach((node) => observer.observe(node));
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [pageCount]);

  const registerPageNode = useCallback((pageNumber: number, node: HTMLDivElement | null) => {
    const previousNode = pageNodesRef.current.get(pageNumber);
    if (previousNode && observerRef.current) {
      observerRef.current.unobserve(previousNode);
    }

    if (node) {
      pageNodesRef.current.set(pageNumber, node);
      if (observerRef.current) {
        observerRef.current.observe(node);
      }
      return;
    }

    pageNodesRef.current.delete(pageNumber);
  }, []);

  const renderThumbnail = useCallback(async (pageNumber: number) => {
    if (thumbnailsRef.current[pageNumber]) return;
    if (renderingPagesRef.current.has(pageNumber)) return;
    if (!pdfDocRef.current) return;

    renderingPagesRef.current.add(pageNumber);
    setRenderingPages((prev) => (prev.includes(pageNumber) ? prev : [...prev, pageNumber]));

    try {
      const page = await pdfDocRef.current.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.28 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Failed to create preview canvas context');
      }

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setThumbnails((prev) => ({ ...prev, [pageNumber]: dataUrl }));

      canvas.width = 0;
      canvas.height = 0;
    } catch (err) {
      console.error(`Failed to render preview for page ${pageNumber}:`, err);
    } finally {
      renderingPagesRef.current.delete(pageNumber);
      setRenderingPages((prev) => prev.filter((page) => page !== pageNumber));
    }
  }, []);

  useEffect(() => {
    visiblePages.forEach((page) => {
      void renderThumbnail(page);
    });
  }, [visiblePages, renderThumbnail]);

  useEffect(() => {
    setRangeInput(serializePageRange(selectedPages));
    setRangeError(null);
  }, [selectedPages]);

  const loadPdf = useCallback(async (selectedFile: File) => {
    setIsLoadingPdf(true);
    setError(null);
    setRangeError(null);
    setSelectedPages([]);
    setRangeInput('');
    setThumbnails({});
    setVisiblePages([]);
    setRenderingPages([]);

    try {
      if (pdfDocRef.current) {
        await pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }

      const fileBytes = await selectedFile.arrayBuffer();
      const previewBytes = new Uint8Array(fileBytes.slice(0));
      const metadataBytes = new Uint8Array(fileBytes.slice(0));

      const parsedPdf = await PDFDocument.load(metadataBytes);
      const totalPages = parsedPdf.getPageCount();

      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const renderedPdf = await pdfjsLib.getDocument({ data: previewBytes }).promise;

      pdfDocRef.current = renderedPdf;
      setFile(selectedFile);
      setPageCount(totalPages);
    } catch (err) {
      console.error('Failed to load PDF:', err);
      resetAll({ keepError: true });
      setError('Unable to load this PDF. Please choose a valid, non-encrypted PDF file.');
    } finally {
      setIsLoadingPdf(false);
    }
  }, [resetAll]);

  const handleFilesSelected = useCallback((files: File[]) => {
    if (files.length === 0) return;
    void loadPdf(files[0]);
  }, [loadPdf]);

  const togglePageSelection = (pageNumber: number) => {
    setSelectedPages((prev) => {
      if (prev.includes(pageNumber)) {
        return prev.filter((page) => page !== pageNumber).sort((a, b) => a - b);
      }

      return [...prev, pageNumber].sort((a, b) => a - b);
    });
  };

  const applyRangeSelection = () => {
    if (pageCount === 0) return;

    const parsed = parsePageRange(rangeInput, pageCount);
    if (parsed.error) {
      setRangeError(parsed.error);
      return;
    }

    setSelectedPages(parsed.pages);
  };

  const selectAllPages = () => {
    setSelectedPages(pageNumbers);
  };

  const clearSelection = () => {
    setSelectedPages([]);
  };

  const resolveDownloadPages = useCallback((): number[] | null => {
    if (pageCount === 0) return null;

    const typedRange = rangeInput.trim();
    if (typedRange.length > 0) {
      const parsed = parsePageRange(typedRange, pageCount);
      if (parsed.error) {
        setRangeError(parsed.error);
        return null;
      }

      if (parsed.pages.length === 0) {
        setError('Select at least one page before extracting.');
        return null;
      }

      setRangeError(null);
      setSelectedPages(parsed.pages);
      return parsed.pages;
    }

    if (selectedPages.length === 0) {
      setError('Select at least one page before extracting.');
      return null;
    }

    return selectedPages;
  }, [pageCount, rangeInput, selectedPages]);

  const buildPerPagePdfs = useCallback(async (pages: number[]): Promise<PerPagePdf[]> => {
    if (!file || pages.length === 0) {
      return [];
    }

    const freshBytes = new Uint8Array(await file.arrayBuffer());
    const sourcePdf = await PDFDocument.load(freshBytes);
    const results: PerPagePdf[] = [];

    for (const pageNumber of pages) {
      const outputPdf = await PDFDocument.create();
      const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageNumber - 1]);
      outputPdf.addPage(copiedPage);
      const outputBytes = await outputPdf.save();

      results.push({
        pageNumber,
        blob: new Blob([outputBytes as BlobPart], { type: 'application/pdf' }),
      });
    }

    return results;
  }, [file]);

  const downloadCombinedPdf = async () => {
    const pages = resolveDownloadPages();
    if (!file || !pages) {
      return;
    }

    setIsDownloadingCombined(true);
    setError(null);

    try {
      const freshBytes = new Uint8Array(await file.arrayBuffer());
      const sourcePdf = await PDFDocument.load(freshBytes);
      const outputPdf = await PDFDocument.create();
      const copiedPages = await outputPdf.copyPages(
        sourcePdf,
        pages.map((pageNumber) => pageNumber - 1)
      );

      copiedPages.forEach((page) => outputPdf.addPage(page));
      const outputBytes = await outputPdf.save();
      const outputBlob = new Blob([outputBytes as BlobPart], { type: 'application/pdf' });

      downloadFile(outputBlob, getCombinedFileName(file.name, pages));
    } catch (err) {
      console.error('Failed to generate extracted PDF:', err);
      setError('Failed to extract pages. Please try again with another PDF.');
    } finally {
      setIsDownloadingCombined(false);
    }
  };

  const downloadPerPageZip = async () => {
    const pages = resolveDownloadPages();
    if (!file || !pages) {
      return;
    }

    setIsDownloadingPerPage(true);
    setError(null);

    try {
      const outputs = await buildPerPagePdfs(pages);
      const zip = new JSZip();
      const baseName = removeFileExtension(file.name);

      outputs.forEach((item) => {
        zip.file(`${baseName}_page_${item.pageNumber}.pdf`, item.blob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadFile(zipBlob, `${baseName}_selected-pages.zip`);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
      setError('Could not create ZIP file for per-page PDFs.');
    } finally {
      setIsDownloadingPerPage(false);
    }
  };

  const downloadPerPageIndividually = async () => {
    const pages = resolveDownloadPages();
    if (!file || !pages) {
      return;
    }

    if (pages.length > 20) {
      const proceed = window.confirm(
        `You selected ${pages.length} pages. This will trigger many browser downloads. Continue?`
      );

      if (!proceed) return;
    }

    setIsDownloadingPerPage(true);
    setError(null);

    try {
      const outputs = await buildPerPagePdfs(pages);
      const baseName = removeFileExtension(file.name);

      outputs.forEach((item) => {
        downloadFile(item.blob, `${baseName}_page_${item.pageNumber}.pdf`);
      });
    } catch (err) {
      console.error('Failed to create per-page PDFs:', err);
      setError('Could not generate individual page PDFs.');
    } finally {
      setIsDownloadingPerPage(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Extract PDF Pages</h1>
        <p className="text-gray-600">
          Upload one PDF, preview pages, select exactly what you need, and download only those pages.
        </p>
      </div>

      <FileDropzone
        accept=".pdf,application/pdf"
        multiple={false}
        onFilesSelected={handleFilesSelected}
        label="Drop a PDF file here"
        sublabel="Your file stays on your device - everything runs in-browser"
      />

      {isLoadingPdf && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">Loading PDF and preparing page previews...</p>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {file && pageCount > 0 && !isLoadingPdf && (
        <>
          <div className="mt-6 p-6 bg-white rounded-xl border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Page Preview</h3>
            <p className="text-sm text-gray-600 mb-4">
              Thumbnails load as you scroll for better performance on large PDFs.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[720px] overflow-auto pr-1">
              {pageNumbers.map((pageNumber) => {
                const isSelected = selectedPages.includes(pageNumber);
                const preview = thumbnails[pageNumber];
                const isRendering = renderingPages.includes(pageNumber);
                const hasEnteredViewport = visiblePages.includes(pageNumber);

                return (
                  <div
                    key={pageNumber}
                    data-page-number={pageNumber}
                    ref={(node) => registerPageNode(pageNumber, node)}
                    className={`relative border rounded-lg overflow-hidden transition-colors ${
                      isSelected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'
                    }`}
                  >
                    <label className="absolute top-2 left-2 z-10 inline-flex items-center gap-1.5 px-2 py-1 bg-white/90 rounded-md text-xs font-medium text-gray-800">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePageSelection(pageNumber)}
                        className="w-3.5 h-3.5"
                      />
                      P{pageNumber}
                    </label>

                    <div className="relative aspect-[3/4] bg-gray-100 flex items-center justify-center">
                      {preview ? (
                        <Image
                          src={preview}
                          alt={`Preview of page ${pageNumber}`}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                          className="object-contain"
                        />
                      ) : isRendering ? (
                        <span className="text-xs text-gray-500">Rendering...</span>
                      ) : hasEnteredViewport ? (
                        <span className="text-xs text-gray-500">Preparing preview...</span>
                      ) : (
                        <span className="text-xs text-gray-400">Scroll to load</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Selection</h2>
                <p className="text-sm text-gray-600">
                  {file.name} • {formatFileSize(file.size)} • {pageCount} page{pageCount > 1 ? 's' : ''}
                </p>
              </div>

              <div className="text-sm text-gray-700">
                Selected: <span className="font-semibold text-gray-900">{selectedPages.length}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Page range input</label>
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(event) => setRangeInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      applyRangeSelection();
                    }
                  }}
                  placeholder="Example: 3-4,7,10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Use commas and ranges. Example: 1,3-5,9</p>
                {rangeError && <p className="text-xs text-red-600 mt-1">{rangeError}</p>}
              </div>

              <button
                onClick={applyRangeSelection}
                className="self-end px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Apply Range
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={selectAllPages}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Clear Selection
              </button>
              <button
                onClick={() => resetAll()}
                className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                Start Over
              </button>
            </div>

            <div className="mt-6 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-700">
                Privacy first: the PDF never leaves your browser. No uploads, no server processing.
              </p>
            </div>
          </div>

          <div className="mt-6 p-6 bg-white rounded-xl border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Download Options</h3>

            <div className="grid gap-3 sm:grid-cols-3">
              <button
                onClick={downloadCombinedPdf}
                disabled={!canAttemptDownload || isDownloadingCombined || isDownloadingPerPage}
                className="py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
              >
                {isDownloadingCombined ? 'Creating PDF...' : 'Download Combined PDF'}
              </button>
              <button
                onClick={downloadPerPageZip}
                disabled={!canAttemptDownload || isDownloadingCombined || isDownloadingPerPage}
                className="py-2.5 px-4 bg-gray-100 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                {isDownloadingPerPage ? 'Preparing...' : 'Per-Page PDFs (ZIP)'}
              </button>
              <button
                onClick={downloadPerPageIndividually}
                disabled={!canAttemptDownload || isDownloadingCombined || isDownloadingPerPage}
                className="py-2.5 px-4 bg-gray-100 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                {isDownloadingPerPage ? 'Preparing...' : 'Per-Page PDFs (Individual)'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}