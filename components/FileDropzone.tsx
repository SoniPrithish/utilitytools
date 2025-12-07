'use client';

import { useCallback, useState, useRef } from 'react';
import { formatFileSize } from '@/lib/utils';

interface FileDropzoneProps {
  accept: string;
  multiple?: boolean;
  maxFiles?: number;
  onFilesSelected: (files: File[]) => void;
  label?: string;
  sublabel?: string;
}

export default function FileDropzone({
  accept,
  multiple = false,
  maxFiles = 10,
  onFilesSelected,
  label = 'Drop files here',
  sublabel = 'or click to browse',
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      
      const fileArray = Array.from(files).slice(0, multiple ? maxFiles : 1);
      setSelectedFiles(fileArray);
      onFilesSelected(fileArray);
    },
    [multiple, maxFiles, onFilesSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-gray-200'}`}>
            <svg
              className={`w-8 h-8 ${isDragging ? 'text-blue-500' : 'text-gray-500'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium text-gray-700">{label}</p>
            <p className="text-sm text-gray-500">{sublabel}</p>
          </div>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700">
              Selected Files ({selectedFiles.length})
            </h4>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFiles();
              }}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Clear all
            </button>
          </div>
          <ul className="space-y-1">
            {selectedFiles.map((file, index) => (
              <li
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
              >
                <span className="truncate max-w-[70%] text-gray-700">{file.name}</span>
                <span className="text-gray-500">{formatFileSize(file.size)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

