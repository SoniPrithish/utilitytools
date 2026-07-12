import DOMPurify from 'dompurify';
import { jsPDF } from 'jspdf';
import { marked } from 'marked';

export interface PdfMarkdownResult {
  markdown: string;
  pageCount: number;
  emptyPages: number[];
}

interface PositionedTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  hasEOL: boolean;
}

interface ExtractedLine {
  text: string;
  y: number;
  fontSize: number;
}

export function renderMarkdownToHtml(markdown: string): string {
  const parsed = marked.parse(markdown, {
    gfm: true,
    breaks: false,
    async: false,
  });

  const sanitized = DOMPurify.sanitize(parsed, {
    USE_PROFILES: { html: true },
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });

  // Local markdown files cannot resolve relative paths without another file upload.
  // Keep embedded images, while replacing network-dependent images with their alt text.
  if (typeof DOMParser === 'undefined') return sanitized;

  const documentFragment = new DOMParser().parseFromString(sanitized, 'text/html');
  documentFragment.querySelectorAll('img').forEach((image) => {
    const source = image.getAttribute('src') ?? '';
    if (source.startsWith('data:image/')) return;

    const replacement = documentFragment.createElement('span');
    const alt = image.getAttribute('alt')?.trim();
    replacement.textContent = alt ? `[Image: ${alt}]` : '[Image]';
    image.replaceWith(replacement);
  });

  return documentFragment.body.innerHTML;
}

export async function createPdfFromMarkdown(element: HTMLElement): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
  });

  const margin = 18;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const renderWidth = Math.max(element.clientWidth, 1);

  // Render the same styled DOM used by the preview, then slice the bitmap at
  // exact A4 boundaries. This avoids jsPDF's CSS parser changing font sizes
  // and splitting individual text fragments across unrelated pages.
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    height: Math.max(element.scrollHeight, 1),
    logging: false,
    scale: 2,
    useCORS: false,
    width: renderWidth,
    windowHeight: Math.max(element.scrollHeight, 1),
    windowWidth: renderWidth,
  });

  const pageHeightPixels = Math.max(
    1,
    Math.floor((contentHeight / contentWidth) * canvas.width),
  );
  const pageCount = Math.max(1, Math.ceil(canvas.height / pageHeightPixels));

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    if (pageIndex > 0) pdf.addPage();

    const sourceY = pageIndex * pageHeightPixels;
    const sliceHeight = Math.min(pageHeightPixels, canvas.height - sourceY);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;

    const context = pageCanvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare the PDF page.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceHeight,
      0,
      0,
      pageCanvas.width,
      pageCanvas.height,
    );

    const imageHeight = (sliceHeight / canvas.width) * contentWidth;
    pdf.addImage(
      pageCanvas.toDataURL('image/png'),
      'PNG',
      margin,
      margin,
      contentWidth,
      imageHeight,
      undefined,
      'FAST',
    );
  }

  return pdf.output('blob');
}

function getTextItem(item: unknown): PositionedTextItem | null {
  if (!item || typeof item !== 'object') return null;

  const candidate = item as {
    str?: unknown;
    transform?: unknown;
    width?: unknown;
    height?: unknown;
    hasEOL?: unknown;
  };

  if (typeof candidate.str !== 'string' || !Array.isArray(candidate.transform)) return null;

  const transform = candidate.transform as unknown[];
  const x = typeof transform[4] === 'number' ? transform[4] : 0;
  const y = typeof transform[5] === 'number' ? transform[5] : 0;
  const transformSize = Math.abs(
    typeof transform[3] === 'number' ? transform[3] : transform[0] as number,
  );
  const fontSize = transformSize || (typeof candidate.height === 'number' ? candidate.height : 12) || 12;

  return {
    text: candidate.str,
    x,
    y,
    width: typeof candidate.width === 'number' ? candidate.width : 0,
    fontSize,
    hasEOL: candidate.hasEOL === true,
  };
}

function joinTextItems(items: PositionedTextItem[]): string {
  let result = '';

  items.forEach((item, index) => {
    if (index === 0) {
      result = item.text;
      return;
    }

    const previous = items[index - 1];
    const previousEnd = previous.x + previous.width;
    const gap = item.x - previousEnd;
    const needsSpace =
      gap > Math.max(1.5, item.fontSize * 0.14) &&
      !/\s$/.test(result) &&
      !/^[,.;:!?%)\]}]/.test(item.text);

    result += `${needsSpace ? ' ' : ''}${item.text}`;
  });

  return result.trimEnd();
}

function extractLines(items: PositionedTextItem[]): ExtractedLine[] {
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 1) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: PositionedTextItem[][] = [];

  sorted.forEach((item) => {
    const currentLine = lines[lines.length - 1];
    const tolerance = Math.max(2, item.fontSize * 0.45);

    if (!currentLine || Math.abs(currentLine[0].y - item.y) > tolerance) {
      lines.push([item]);
      return;
    }

    currentLine.push(item);
  });

  return lines
    .map((line) => {
      const lineItems = [...line].sort((a, b) => a.x - b.x);
      return {
        text: joinTextItems(lineItems),
        y: Math.max(...lineItems.map((item) => item.y)),
        fontSize: Math.max(...lineItems.map((item) => item.fontSize)),
      };
    })
    .filter((line) => line.text.length > 0);
}

function linesToMarkdown(lines: ExtractedLine[]): string {
  if (lines.length === 0) return '';

  const output: string[] = [];
  let previous: ExtractedLine | null = null;

  lines.forEach((line) => {
    if (previous) {
      const verticalGap = previous.y - line.y;
      const expectedLineHeight = Math.max(previous.fontSize, line.fontSize) * 1.25;
      if (verticalGap > expectedLineHeight * 1.55) output.push('');
    }

    output.push(line.text);
    previous = line;
  });

  return output.join('\n').trim();
}

export async function extractPdfToMarkdown(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<PdfMarkdownResult> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageCount = pdf.numPages;
  const pages: string[] = [];
  const emptyPages: number[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items
        .map(getTextItem)
        .filter((item): item is PositionedTextItem => item !== null);
      const pageMarkdown = linesToMarkdown(extractLines(items));

      if (!pageMarkdown) {
        emptyPages.push(pageNumber);
        pages.push(`<!-- Page ${pageNumber} contains no selectable text and was skipped. -->`);
      } else {
        pages.push(pageMarkdown);
      }

      onProgress?.(Math.round((pageNumber / pageCount) * 100));
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  return {
    markdown: pages.join('\n\n').trim() + (pages.length > 0 ? '\n' : ''),
    pageCount,
    emptyPages,
  };
}
