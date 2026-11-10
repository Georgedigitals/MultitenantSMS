'use client';

import React, { useState } from 'react';
import { Camera, X, ZoomIn, Image as ImageIcon } from 'lucide-react';

interface GalleryItem {
  id: string;
  imageUrl: string;
  caption: string | null;
  album: string | null;
}

interface GalleryClientProps {
  images: GalleryItem[];
  primaryColor: string;
}

export function GalleryClient({ images, primaryColor }: GalleryClientProps) {
  const [selectedAlbum, setSelectedAlbum] = useState<string>('all');
  const [activeLightboxImg, setActiveLightboxImg] = useState<GalleryItem | null>(null);

  // Extract unique albums
  const albums = ['all', ...Array.from(new Set(images.map((img) => img.album).filter(Boolean))) as string[]];

  const filteredImages = selectedAlbum === 'all'
    ? images
    : images.filter((img) => img.album === selectedAlbum);

  if (images.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 max-w-2xl mx-auto my-12">
        <Camera className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 mb-1">Photo Gallery Coming Soon</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Our school administration is currently curating high-definition photographs of recent events, laboratories, and campus facilities.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Album Filter Tabs */}
      {albums.length > 2 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {albums.map((alb) => (
            <button
              key={alb}
              type="button"
              onClick={() => setSelectedAlbum(alb)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                selectedAlbum === alb
                  ? 'text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              style={selectedAlbum === alb ? { backgroundColor: primaryColor } : undefined}
            >
              {alb === 'all' ? 'All Photographs' : alb}
            </button>
          ))}
        </div>
      )}

      {/* Photo Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredImages.map((img) => (
          <div
            key={img.id}
            onClick={() => setActiveLightboxImg(img)}
            className="group relative overflow-hidden rounded-2xl bg-slate-100 border border-slate-200 shadow-sm hover:shadow-xl transition-all cursor-pointer"
          >
            <div className="aspect-4/3 overflow-hidden">
              <img
                src={img.imageUrl}
                alt={img.caption || 'Campus Photo'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>

            {/* Hover overlay with zoom icon */}
            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-md">
                <ZoomIn className="w-6 h-6" />
              </div>
            </div>

            {/* Caption bar */}
            {img.caption && (
              <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800 truncate">{img.caption}</p>
                {img.album && (
                  <span className="text-[10px] font-mono text-slate-400 uppercase shrink-0 ml-2">
                    {img.album}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {activeLightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setActiveLightboxImg(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveLightboxImg(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/70 text-white hover:bg-slate-950 transition-colors"
              aria-label="Close Lightbox"
            >
              <X className="w-5 h-5" />
            </button>

            <img
              src={activeLightboxImg.imageUrl}
              alt={activeLightboxImg.caption || 'Campus View'}
              className="max-h-[75vh] w-auto mx-auto object-contain"
            />

            {activeLightboxImg.caption && (
              <div className="p-4 bg-slate-950 text-white border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="font-bold">{activeLightboxImg.caption}</span>
                {activeLightboxImg.album && (
                  <span className="text-slate-400 font-mono text-[10px] uppercase">
                    Album: {activeLightboxImg.album}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
