import { forwardRef } from 'react';

interface MarkdownDocumentProps {
  html: string;
  className?: string;
}

const MarkdownDocument = forwardRef<HTMLElement, MarkdownDocumentProps>(function MarkdownDocument(
  { html, className = '' },
  ref,
) {
  return (
    <article
      ref={ref}
      className={`markdown-document ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export default MarkdownDocument;
