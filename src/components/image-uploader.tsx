'use client';

import React, { useState, useRef } from 'react';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  description?: string;
  placeholderUrl?: string;
  aspectRatio?: 'banner' | 'square' | 'gallery';
  className?: string;
}

export function ImageUploader({
  value,
  onChange,
  label = 'Upload Image',
  description = 'Drag & drop your image here or click to browse (JPEG, PNG, WebP up to 5MB)',
  aspectRatio = 'banner',
  className = '',
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setImgError(false);

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, WebP, or GIF).');
      return;
    }

    // Validate size
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file is too large (max 5MB).');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/tenant/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }

      onChange(data.url);
    } catch (err: any) {
      setError(err.message || 'Image upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleApplyCustomUrl = () => {
    if (customUrl.trim()) {
      onChange(customUrl.trim());
      setCustomUrl('');
      setShowUrlInput(false);
    }
  };

  const aspectClasses = {
    banner: 'h-48 sm:h-56',
    square: 'h-40 w-40',
    gallery: 'h-48',
  }[aspectRatio];

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <label className="block text-xs font-bold uppercase tracking-wider adm-text-primary">{label}</label>}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {value ? (
        /* Image Preview State */
        <div className="relative group rounded-2xl overflow-hidden border adm-divider adm-surface p-2 shadow-sm">
          <div className={`relative ${aspectClasses} rounded-xl overflow-hidden bg-slate-950/40 flex items-center justify-center`}>
            {!imgError ? (
              <img
                src={value}
                alt="Uploaded Preview"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="text-center p-4 text-slate-400">
                <svg className="w-8 h-8 mx-auto mb-1 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-xs font-semibold text-amber-500 block">External URL unreachable</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Click &quot;Change Image&quot; below to upload a photo</span>
              </div>
            )}
            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-xs">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-900 shadow-md hover:bg-slate-100 transition-all cursor-pointer"
              >
                Change Image
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white shadow-md hover:bg-rose-500 transition-all cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
          <div className="mt-2 px-2 pb-1 flex items-center justify-between text-[11px] adm-text-muted">
            <span className="truncate max-w-[240px]">Image Active</span>
            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="text-indigo-400 hover:underline font-medium"
            >
              {showUrlInput ? 'Hide URL' : 'Edit Direct URL'}
            </button>
          </div>
        </div>
      ) : (
        /* Dropzone State */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
            isDragging
              ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
              : 'border-slate-300 dark:border-slate-700 adm-surface hover:border-indigo-500 hover:bg-indigo-500/5'
          } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {uploading ? (
            <div className="py-4 flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-3 border-indigo-500 border-t-transparent animate-spin" />
              <span className="text-xs font-semibold text-indigo-400">Uploading Image...</span>
            </div>
          ) : (
            <div className="py-2 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shadow-inner">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold adm-text-primary">
                  Click to upload <span className="font-normal adm-text-muted">or drag & drop</span>
                </p>
                <p className="text-[11px] adm-text-muted mt-1">{description}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Custom URL Fallback Toggle */}
      {(showUrlInput || !value) && (
        <div className="pt-1 flex items-center gap-2">
          <input
            type="url"
            placeholder="Or paste external image URL (https://...)"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            className="adm-input flex-1 border rounded-xl px-3 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={handleApplyCustomUrl}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs"
          >
            Apply URL
          </button>
        </div>
      )}
    </div>
  );
}
