'use client';

import { useState } from 'react';
import FileDropzone from '@/components/FileDropzone';
import { downloadFile, formatFileSize, removeFileExtension } from '@/lib/utils';
import JSZip from 'jszip';

interface ResizedImage {
    original: File;
    resized: Blob;
    dataUrl: string;
    originalWidth: number;
    originalHeight: number;
    newWidth: number;
    newHeight: number;
}

type ResizeMode = 'percentage' | 'pixels';

export default function ResizeImagePage() {
    const [files, setFiles] = useState<File[]>([]);
    const [resizeMode, setResizeMode] = useState<ResizeMode>('percentage');
    const [percentage, setPercentage] = useState(50);
    const [pixelWidth, setPixelWidth] = useState(800);
    const [pixelHeight, setPixelHeight] = useState(600);
    const [lockAspectRatio, setLockAspectRatio] = useState(true);
    const [originalAspectRatio, setOriginalAspectRatio] = useState(4 / 3);
    const [isResizing, setIsResizing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<ResizedImage[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleFilesSelected = async (selectedFiles: File[]) => {
        setFiles(selectedFiles);
        setResults([]);
        setError(null);

        // Get dimensions of first image to set initial pixel values
        if (selectedFiles.length > 0) {
            const dimensions = await getImageDimensions(selectedFiles[0]);
            setPixelWidth(dimensions.width);
            setPixelHeight(dimensions.height);
            setOriginalAspectRatio(dimensions.width / dimensions.height);
        }
    };

    const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve({ width: img.width, height: img.height });
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleWidthChange = (newWidth: number) => {
        setPixelWidth(newWidth);
        if (lockAspectRatio && originalAspectRatio > 0) {
            setPixelHeight(Math.round(newWidth / originalAspectRatio));
        }
    };

    const handleHeightChange = (newHeight: number) => {
        setPixelHeight(newHeight);
        if (lockAspectRatio && originalAspectRatio > 0) {
            setPixelWidth(Math.round(newHeight * originalAspectRatio));
        }
    };

    // Resize by percentage or pixels
    const resizeByDimensions = (
        img: HTMLImageElement,
        targetWidth: number,
        targetHeight: number
    ): Promise<{ blob: Blob; dataUrl: string }> => {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            fetch(dataUrl)
                .then((res) => res.blob())
                .then((blob) => resolve({ blob, dataUrl }))
                .catch(reject);
        });
    };

    const resizeImage = async (file: File): Promise<ResizedImage> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                const img = new Image();

                img.onload = async () => {
                    try {
                        let result: { blob: Blob; dataUrl: string };
                        let newWidth: number;
                        let newHeight: number;

                        if (resizeMode === 'percentage') {
                            newWidth = Math.round(img.width * (percentage / 100));
                            newHeight = Math.round(img.height * (percentage / 100));
                            result = await resizeByDimensions(img, newWidth, newHeight);
                        } else {
                            newWidth = pixelWidth;
                            newHeight = pixelHeight;
                            result = await resizeByDimensions(img, newWidth, newHeight);
                        }

                        resolve({
                            original: file,
                            resized: result.blob,
                            dataUrl: result.dataUrl,
                            originalWidth: img.width,
                            originalHeight: img.height,
                            newWidth,
                            newHeight,
                        });
                    } catch (err) {
                        reject(err);
                    }
                };

                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target?.result as string;
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    };

    const resizeAllImages = async () => {
        if (files.length === 0) return;

        setIsResizing(true);
        setProgress(0);
        setError(null);
        const resized: ResizedImage[] = [];
        let hasErrors = false;

        for (let i = 0; i < files.length; i++) {
            try {
                const result = await resizeImage(files[i]);
                resized.push(result);
                setProgress(Math.round(((i + 1) / files.length) * 100));
            } catch (err) {
                console.error(`Error resizing ${files[i].name}:`, err);
                hasErrors = true;
            }
        }

        if (resized.length === 0 && hasErrors) {
            setError('Failed to resize images. Please make sure you selected valid image files.');
        } else if (hasErrors) {
            setError(`Some images could not be resized. ${resized.length} of ${files.length} succeeded.`);
        }

        setResults(resized);
        setIsResizing(false);
    };

    const downloadImage = (result: ResizedImage) => {
        const filename = `${removeFileExtension(result.original.name)}_resized.jpg`;
        downloadFile(result.resized, filename);
    };

    const downloadAllAsZip = async () => {
        if (results.length === 0) return;

        const zip = new JSZip();

        results.forEach((result) => {
            const filename = `${removeFileExtension(result.original.name)}_resized.jpg`;
            zip.file(filename, result.resized);
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadFile(zipBlob, 'resized_images.zip');
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-12">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Resize Image</h1>
                <p className="text-gray-600">
                    Resize images by percentage or exact dimensions. All processing happens locally in your browser.
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

            {files.length > 0 && results.length === 0 && !isResizing && (
                <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Resize Settings</h3>

                    <div className="space-y-6">
                        {/* Resize Mode Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Resize By
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setResizeMode('percentage')}
                                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${resizeMode === 'percentage'
                                            ? 'bg-gray-900 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Percentage
                                </button>
                                <button
                                    onClick={() => setResizeMode('pixels')}
                                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${resizeMode === 'pixels'
                                            ? 'bg-gray-900 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Width × Height
                                </button>
                            </div>
                        </div>

                        {/* Percentage Mode */}
                        {resizeMode === 'percentage' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Scale: {percentage}%
                                </label>
                                <input
                                    type="range"
                                    min="10"
                                    max="200"
                                    step="5"
                                    value={percentage}
                                    onChange={(e) => setPercentage(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>10%</span>
                                    <span>100%</span>
                                    <span>200%</span>
                                </div>
                            </div>
                        )}

                        {/* Pixels Mode */}
                        {resizeMode === 'pixels' && (
                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Width (px)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10000"
                                            value={pixelWidth}
                                            onChange={(e) => handleWidthChange(parseInt(e.target.value) || 1)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <button
                                            onClick={() => setLockAspectRatio(!lockAspectRatio)}
                                            className={`p-2 rounded-lg transition-colors ${lockAspectRatio ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                                                }`}
                                            title={lockAspectRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                {lockAspectRatio ? (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                ) : (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                                )}
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Height (px)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10000"
                                            value={pixelHeight}
                                            onChange={(e) => handleHeightChange(parseInt(e.target.value) || 1)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500">
                                    {lockAspectRatio ? '🔒 Aspect ratio locked' : '🔓 Aspect ratio unlocked'}
                                </p>
                            </div>
                        )}

                        {/* Privacy Notice */}
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 text-green-700">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <span className="text-sm font-medium">100% Private & Secure</span>
                            </div>
                            <p className="text-xs text-green-600 mt-1">
                                Your files never leave your device. All processing happens in your browser.
                            </p>
                        </div>

                        <button
                            onClick={resizeAllImages}
                            disabled={isResizing}
                            className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
                        >
                            {isResizing
                                ? `Resizing... ${progress}%`
                                : `Resize ${files.length} Image${files.length > 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>
            )}

            {results.length > 0 && (
                <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Resize Complete</h3>
                            <p className="text-sm text-gray-600">
                                {results.length} image{results.length > 1 ? 's' : ''} resized
                            </p>
                        </div>
                        {results.length === 1 ? (
                            <button
                                onClick={() => downloadImage(results[0])}
                                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                Download Image
                            </button>
                        ) : (
                            <button
                                onClick={downloadAllAsZip}
                                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                            >
                                Download All (ZIP)
                            </button>
                        )}
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
                                        className="w-12 h-12 object-cover rounded"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {result.original.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {result.originalWidth}×{result.originalHeight} → {result.newWidth}×{result.newHeight}
                                            <span className="mx-2">•</span>
                                            {formatFileSize(result.original.size)} → {formatFileSize(result.resized.size)}
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
                        className="w-full mt-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Start over
                    </button>
                </div>
            )}
        </div>
    );
}
