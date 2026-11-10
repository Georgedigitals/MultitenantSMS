'use client';

import React, { useState, useRef } from 'react';

interface ImageUploadInputProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  endpoint?: string;
  folder?: string;
  helperText?: string;
  recommendedDimensions?: string;
  previewShape?: 'square' | 'circle' | 'landscape';
}

export default function ImageUploadInput({
  label,
  value,
  onChange,
  endpoint = '/api/tenant/upload',
  folder = 'logos',
  helperText,
  recommendedDimensions = 'PNG, JPEG, WebP or GIF up to 5MB',
  previewShape = 'square',
}: ImageUploadInputProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit.');
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Please select a raster image (PNG, JPG, WebP, or GIF).');
      return;
    }

    setError(null);
    setImgError(false);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }

      onChange(data.url);
      setImgError(false);
    } catch (err: any) {
      setError(err.message || 'Image upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const shapeClasses = {
    square: 'w-24 h-24 rounded-2xl',
    circle: 'w-24 h-24 rounded-full',
    landscape: 'w-44 h-24 rounded-2xl',
  }[previewShape];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-800 tracking-tight">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
        >
          {showUrlInput ? 'Switch to File Upload' : 'Or paste direct URL'}
        </button>
      </div>

      {showUrlInput ? (
        <div className="space-y-1.5">
          <input
            type="url"
            value={value}
            onChange={(e) => {
              setError(null);
              onChange(e.target.value);
            }}
            placeholder="https://example.com/images/school-logo.png"
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-2xs"
          />
          <p className="text-[11px] text-slate-500 font-sans">
            Paste a public HTTPS link to an image file.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            {/* Image Preview Box */}
            <div
              className={`${shapeClasses} bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden shadow-2xs relative group`}
            >
              {value && !imgError ? (
                <img
                  src={value}
                  alt={label}
                  className="w-full h-full object-contain p-1.5"
                  onError={() => setImgError(true)}
                />
              ) : value && imgError ? (
                <div className="text-center p-2 text-slate-400">
                  <svg className="w-5 h-5 mx-auto mb-0.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-[8px] font-semibold text-amber-600 block">No Image</span>
                </div>
              ) : (
                <div className="text-center p-2 text-slate-400">
                  <svg className="w-6 h-6 mx-auto mb-0.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[9px] font-semibold uppercase tracking-wider block">No image</span>
                </div>
              )}

              {uploading && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />

              <div className="flex flex-col items-center justify-center space-y-1">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div className="text-xs font-semibold text-slate-700">
                  <span className="text-blue-600 hover:underline">Click to browse</span> or drag and drop
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {recommendedDimensions}
                </div>
              </div>
            </div>
          </div>

          {/* Action Row if Image is Present */}
          {value && (
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-[11px] font-mono text-slate-500 truncate max-w-xs">
                {value}
              </span>
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setError(null);
                }}
                className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold transition-colors"
              >
                Remove Image
              </button>
            </div>
          )}
        </div>
      )}

      {helperText && (
        <p className="text-[11px] text-slate-500 leading-relaxed">{helperText}</p>
      )}

      {error && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
