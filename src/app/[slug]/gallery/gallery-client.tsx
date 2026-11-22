'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

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

  const albums = ['all', ...(Array.from(new Set(images.map((img) => img.album).filter(Boolean))) as string[])];

  const filteredImages =
    selectedAlbum === 'all' ? images : images.filter((img) => img.album === selectedAlbum);

  if (images.length === 0) {
    return (
      <div className="bg-white border border-[#e4e2dd] px-8 py-16 text-center max-w-2xl mx-auto">
        <h2 className="tenant-editorial-display text-[30px] text-[#0a0a0a]">
          Campus gallery coming soon
        </h2>
        <p className="mt-3 text-[15px] text-[#66645e] leading-relaxed">
          Photographs from classrooms, laboratories, and school events will appear here once uploaded by the school administration.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Album Filter Tabs */}
      {albums.length > 2 && (
        <div className="flex flex-wrap items-center gap-2 mb-10 pb-6 border-b border-[#e4e2dd]">
          {albums.map((alb) => {
            const active = selectedAlbum === alb;
            return (
              <button
                key={alb}
                type="button"
                onClick={() => setSelectedAlbum(alb)}
                className={`h-9 px-4 text-[13px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'text-white'
                    : 'bg-white border border-[#e4e2dd] text-[#4f4d48] hover:text-[#0a0a0a] hover:bg-[#eceae6]'
                }`}
                style={active ? { backgroundColor: primaryColor || '#141414' } : undefined}
              >
                {alb === 'all' ? 'All photographs' : alb}
              </button>
            );
          })}
        </div>
      )}

      {/* Square-Cropped Editorial Photo Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredImages.map((img) => (
          <figure
            key={img.id}
            onClick={() => setActiveLightboxImg(img)}
            className="group bg-white border border-[#e4e2dd] cursor-pointer overflow-hidden"
          >
            <div className="aspect-[4/3] overflow-hidden bg-[#eceae6]">
              <img
                src={img.imageUrl}
                alt={img.caption || 'Campus photograph'}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
            </div>

            {(img.caption || img.album) && (
              <figcaption className="px-4 py-3.5 border-t border-[#efede9] flex items-center justify-between gap-3">
                <span className="text-[14px] font-medium text-[#0a0a0a] truncate">
                  {img.caption || img.album}
                </span>
                {img.album && img.caption && (
                  <span className="text-[12px] text-[#66645e] shrink-0">
                    {img.album}
                  </span>
                )}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {/* Clean Lightbox Modal */}
      {activeLightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-[#0a0a0a]/90 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setActiveLightboxImg(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-5xl w-full bg-[#111315] border border-white/15 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveLightboxImg(null)}
              className="absolute top-4 right-4 z-10 h-10 w-10 bg-[#111315]/80 text-white hover:bg-[#111315] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close photo view"
            >
              <X className="w-5 h-5" />
            </button>

            <img
              src={activeLightboxImg.imageUrl}
              alt={activeLightboxImg.caption || 'Campus photograph'}
              className="max-h-[78vh] w-full object-contain bg-[#0a0a0a]"
            />

            {(activeLightboxImg.caption || activeLightboxImg.album) && (
              <div className="px-5 py-4 bg-[#111315] text-white border-t border-white/15 flex items-center justify-between gap-4 text-[14px]">
                <span className="font-medium">{activeLightboxImg.caption || activeLightboxImg.album}</span>
                {activeLightboxImg.album && (
                  <span className="text-[#9b9890] text-[13px] shrink-0">
                    {activeLightboxImg.album}
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
