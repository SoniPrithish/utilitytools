'use client';

import { useState } from 'react';
import { jsPDF } from 'jspdf';
import FileDropzone from '@/components/FileDropzone';
import { downloadFile, removeFileExtension } from '@/lib/utils';

interface ImageFile {
  id: string;
  file: File;
  dataUrl: string;
  width: number;
  height: number;
}

export default function ImageToPdfPage() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [pageSize, setPageSize] = useState<'a4' | 'letter' | 'fit'>('fit'); // default to fit to keep original dimensions
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isConverting, setIsConverting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    const newImages: ImageFile[] = [];
    
    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);
      const dimensions = await getImageDimensions(dataUrl);
      
      newImages.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        dataUrl,
        width: dimensions.width,
        height: dimensions.height,
      });
    }
    
    setImages((prev) => [...prev, ...newImages]);
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  };

  const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.src = dataUrl;
    });
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);
    setImages(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const convertToPdf = async () => {
    if (images.length === 0) return;

    setIsConverting(true);
    setError(null);

    try {
      let pdf: jsPDF;
      
      if (pageSize === 'fit') {
        // Use first image dimensions for the PDF, no scaling
        const firstImg = images[0];
        pdf = new jsPDF({
          orientation: firstImg.width > firstImg.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [firstImg.width, firstImg.height],
        });
      } else {
        pdf = new jsPDF({
          orientation: orientation,
          unit: 'mm',
          format: pageSize,
        });
      }

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        if (i > 0) {
          if (pageSize === 'fit') {
            pdf.addPage([img.width, img.height], img.width > img.height ? 'landscape' : 'portrait');
          } else {
            pdf.addPage(pageSize, orientation);
          }
        }

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        if (pageSize === 'fit') {
          // No scaling, keep original pixel dimensions
          pdf.addImage(img.dataUrl, 'JPEG', 0, 0, pageWidth, pageHeight);
        } else {
          // Calculate aspect ratio to fit image on page with margins
          const margin = 10; // mm
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
          
          pdf.addImage(img.dataUrl, 'JPEG', x, y, imgWidth, imgHeight);
        }
      }

      const pdfBlob = pdf.output('blob');
      const filename = images.length === 1 
        ? `${removeFileExtension(images[0].file.name)}.pdf`
        : 'combined_images.pdf';
      
      downloadFile(pdfBlob, filename);
    } catch (err) {
      console.error('Error creating PDF:', err);
      setError('Failed to create PDF. Please try again.');
    }

    setIsConverting(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Image to PDF</h1>
        <p className="text-gray-600">
          Combine multiple images into a single PDF. Drag to reorder pages.
        </p>
      </div>

      <FileDropzone
        accept="image/*"
        multiple={true}
        maxFiles={50}
        onFilesSelected={handleFilesSelected}
        label="Drop images here"
        sublabel="PNG, JPG, WebP - up to 50 images"
      />

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {images.length > 0 && (
        <>
          <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {images.length} Image{images.length > 1 ? 's' : ''} Selected
              </h3>
              <button
                onClick={() => setImages([])}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Clear all
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative group aspect-square rounded-lg overflow-hidden border-2 cursor-move ${
                    draggedIndex === index ? 'border-blue-500 opacity-50' : 'border-gray-200'
                  }`}
                >
                  <img
                    src={img.dataUrl}
                    alt={img.file.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => removeImage(img.id)}
                      className="p-1.5 bg-red-500 text-white rounded-full"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/70 text-white text-xs rounded">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Page Size
                </label>
              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="fit"
                    checked={pageSize === 'fit'}
                    onChange={() => setPageSize('fit')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Fit to Image (original size)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="a4"
                    checked={pageSize === 'a4'}
                    onChange={() => setPageSize('a4')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">A4</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="letter"
                    checked={pageSize === 'letter'}
                    onChange={() => setPageSize('letter')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Letter</span>
                </label>
              </div>
              </div>

              {pageSize !== 'fit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Orientation
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="portrait"
                        checked={orientation === 'portrait'}
                        onChange={() => setOrientation('portrait')}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Portrait</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="landscape"
                        checked={orientation === 'landscape'}
                        onChange={() => setOrientation('landscape')}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Landscape</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={convertToPdf}
            disabled={isConverting}
            className="w-full mt-6 py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
          >
            {isConverting ? 'Creating PDF...' : 'Create PDF'}
          </button>

          <button
            onClick={() => {
              setImages([]);
              setError(null);
            }}
            className="w-full mt-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Start over
          </button>
        </>
      )}
    </div>
  );
}

