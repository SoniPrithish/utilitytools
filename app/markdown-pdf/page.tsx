'use client';

import { useCallback, useRef, useState } from 'react';
import FileDropzone from '@/components/FileDropzone';
import MarkdownDocument from '@/components/MarkdownDocument';
import {
  createPdfFromMarkdown,
  extractPdfToMarkdown,
  renderMarkdownToHtml,
} from '@/lib/markdown-pdf';
import { downloadFile, formatFileSize, getFileExtension, removeFileExtension } from '@/lib/utils';

type ConversionMode = 'markdown-to-pdf' | 'pdf-to-markdown';

function isMarkdownFile(file: File): boolean {
  return ['md', 'markdown', 'mdown', 'mkdn'].includes(getFileExtension(file.name));
}

function isPdfFile(file: File): boolean {
  return getFileExtension(file.name) === 'pdf' || file.type === 'application/pdf';
}

export default function MarkdownPdfPage() {
  const [mode, setMode] = useState<ConversionMode>('markdown-to-pdf');
  const [file, setFile] = useState<File | null>(null);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [outputMarkdown, setOutputMarkdown] = useState('');
  const [emptyPages, setEmptyPages] = useState<number[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dropzoneKey, setDropzoneKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);

  const resetState = useCallback((resetDropzone = false) => {
    setFile(null);
    setRenderedHtml('');
    setOutputMarkdown('');
    setEmptyPages([]);
    setPageCount(0);
    setIsConverting(false);
    setProgress(0);
    setError(null);
    setNotice(null);
    if (resetDropzone) setDropzoneKey((value) => value + 1);
  }, []);

  const handleModeChange = (nextMode: ConversionMode) => {
    if (nextMode === mode) return;
    resetState(true);
    setMode(nextMode);
  };

  const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
    const selectedFile = selectedFiles[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setRenderedHtml('');
    setOutputMarkdown('');
    setEmptyPages([]);
    setPageCount(0);
    setProgress(0);
    setError(null);
    setNotice(null);

    try {
      if (mode === 'markdown-to-pdf') {
        if (!isMarkdownFile(selectedFile)) {
          throw new Error('Please select a Markdown file with a .md or .markdown extension.');
        }

        const source = await selectedFile.text();
        setRenderedHtml(renderMarkdownToHtml(source));
      } else if (!isPdfFile(selectedFile)) {
        throw new Error('Please select a valid PDF file.');
      }
    } catch (selectionError) {
      setFile(null);
      setError(selectionError instanceof Error ? selectionError.message : 'Unable to read this file.');
    }
  }, [mode]);

  const convertMarkdownToPdf = async () => {
    if (!file || !previewRef.current || !renderedHtml) return;

    setIsConverting(true);
    setError(null);
    setNotice(null);

    try {
      const pdfBlob = await createPdfFromMarkdown(previewRef.current);
      downloadFile(pdfBlob, `${removeFileExtension(file.name)}.pdf`);
      setNotice('PDF created and downloaded successfully.');
    } catch (conversionError) {
      console.error('Error creating Markdown PDF:', conversionError);
      setError('Failed to create the PDF. Try a shorter document or a simpler Markdown file.');
    } finally {
      setIsConverting(false);
    }
  };

  const convertPdfToMarkdown = async () => {
    if (!file) return;

    setIsConverting(true);
    setProgress(0);
    setError(null);
    setNotice(null);
    setOutputMarkdown('');
    setEmptyPages([]);

    try {
      const result = await extractPdfToMarkdown(file, setProgress);
      setOutputMarkdown(result.markdown);
      setEmptyPages(result.emptyPages);
      setPageCount(result.pageCount);
      setNotice('Markdown extracted successfully. Review the result before downloading.');
    } catch (conversionError) {
      console.error('Error extracting PDF text:', conversionError);
      setError('Failed to read this PDF. It may be invalid, encrypted, or unsupported.');
    } finally {
      setIsConverting(false);
    }
  };

  const downloadMarkdown = () => {
    if (!file || !outputMarkdown) return;

    const markdownBlob = new Blob([outputMarkdown], { type: 'text/markdown;charset=utf-8' });
    downloadFile(markdownBlob, `${removeFileExtension(file.name)}.md`);
  };

  const isMarkdownMode = mode === 'markdown-to-pdf';

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Markdown ↔ PDF</h1>
        <p className="text-gray-600">
          Convert Markdown and selectable-text PDFs locally in your browser. Your files never leave your device.
        </p>
      </div>

      <div
        className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1"
        role="group"
        aria-label="Conversion direction"
      >
        <button
          type="button"
          aria-pressed={isMarkdownMode}
          onClick={() => handleModeChange('markdown-to-pdf')}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isMarkdownMode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Markdown to PDF
        </button>
        <button
          type="button"
          aria-pressed={!isMarkdownMode}
          onClick={() => handleModeChange('pdf-to-markdown')}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            !isMarkdownMode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          PDF to Markdown
        </button>
      </div>

      <FileDropzone
        key={`${mode}-${dropzoneKey}`}
        accept={isMarkdownMode ? '.md,.markdown,text/markdown' : '.pdf,application/pdf'}
        multiple={false}
        onFilesSelected={handleFilesSelected}
        onFilesCleared={() => resetState()}
        label={isMarkdownMode ? 'Drop a Markdown file here' : 'Drop a PDF here'}
        sublabel={isMarkdownMode ? 'Markdown files only (.md or .markdown)' : 'PDF files with selectable text'}
      />

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {notice && !error && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4" role="status">
          <p className="text-sm text-green-700">{notice}</p>
        </div>
      )}

      {file && isMarkdownMode && renderedHtml && (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Markdown Preview</h2>
              <p className="text-sm text-gray-500">{file.name} · {formatFileSize(file.size)}</p>
            </div>
            <span className="hidden rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 sm:inline-flex">
              A4 PDF
            </span>
          </div>

          <div className="max-h-[620px] overflow-auto rounded-lg border border-gray-200 bg-white p-6 sm:p-8">
            <MarkdownDocument ref={previewRef} html={renderedHtml} />
          </div>

          <button
            type="button"
            onClick={convertMarkdownToPdf}
            disabled={isConverting}
            className="mt-6 w-full rounded-lg bg-gray-900 px-4 py-3 font-medium text-white transition-colors hover:bg-gray-800 disabled:bg-gray-400"
          >
            {isConverting ? 'Creating PDF...' : 'Download PDF'}
          </button>
        </div>
      )}

      {file && !isMarkdownMode && !outputMarkdown && !isConverting && (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-900">Ready to convert</h2>
          <p className="mt-1 text-sm text-gray-600">
            Text will be grouped into readable Markdown paragraphs. Pages without selectable text will be marked in the output.
          </p>
          <button
            type="button"
            onClick={convertPdfToMarkdown}
            className="mt-6 w-full rounded-lg bg-gray-900 px-4 py-3 font-medium text-white transition-colors hover:bg-gray-800"
          >
            Convert to Markdown
          </button>
        </div>
      )}

      {isConverting && !isMarkdownMode && (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900">Extracting PDF text...</span>
            <span className="text-gray-500">{progress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {outputMarkdown && !isMarkdownMode && (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Markdown Result</h2>
              <p className="text-sm text-gray-600">
                {pageCount} page{pageCount === 1 ? '' : 's'} extracted from {file?.name}
              </p>
            </div>
            <button
              type="button"
              onClick={downloadMarkdown}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              Download Markdown
            </button>
          </div>

          {emptyPages.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-700">
                {emptyPages.length} page{emptyPages.length === 1 ? '' : 's'} had no selectable text and were marked in the Markdown output.
              </p>
            </div>
          )}

          <textarea
            readOnly
            value={outputMarkdown}
            aria-label="Extracted Markdown"
            spellCheck={false}
            className="mt-4 min-h-[360px] w-full resize-y rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-sm leading-6 text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      )}

      {file && (
        <button
          type="button"
          onClick={() => resetState(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Start over
        </button>
      )}
    </div>
  );
}
