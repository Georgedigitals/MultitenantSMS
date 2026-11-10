'use client';

import React from 'react';
import Link from 'next/link';
import { FeaturedStudent } from './featured-student';
import { SchoolHero } from './school-hero';
import type { PublicSiteData } from '@/lib/site-content';
import {
  Heart,
  Smile,
  Sun,
  Shield,
  ArrowRight,
  Camera,
  Star,
  MapPin,
  Calendar,
  Sparkles,
  Phone,
  Check,
  Quote,
} from 'lucide-react';

interface TemplateProps {
  data: PublicSiteData;
}

export function HorizonTemplate({ data }: TemplateProps) {
  const { tenant, branding, hero, about, academics, admissions, contact, gallery } = data;
  const primaryColor = branding.primaryColor || '#2D6A4F'; // Warm forest sage
  const accentColor = branding.accentColor || '#E76F51'; // Terracotta warm coral

  const heroImage = hero.imageUrl || (gallery[0]?.imageUrl) || null;
  const secondaryImage = gallery[1]?.imageUrl || heroImage;

  return (
    <div className="font-sans text-stone-800 bg-[#FCFBF7] selection:bg-amber-200 selection:text-stone-900">
      
      <SchoolHero data={data} variant="horizon" />

      {/* Featured Student */}
      <FeaturedStudent data={data} />

      {/* ── 2. FOUR PILLARS OF CHILD NURTURE & HOLISTIC CARE ── */}
      <section className="py-20 lg:py-28 bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
              Our Educational Heart
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight">
              Care, Discovery &amp; Character
            </h2>
            <p className="text-sm text-stone-600">
              We focus on building emotional resilience and creative confidence alongside academic readiness.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="p-6 rounded-3xl bg-amber-50/60 border border-amber-200/60 flex flex-col justify-between hover:shadow-lg transition-all">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
                  <Sun className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-stone-900 mb-2">Holistic Joy</h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Active, inquiry-driven learning that sparks genuine enthusiasm for mathematics, arts, and reading.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-emerald-50/60 border border-emerald-200/60 flex flex-col justify-between hover:shadow-lg transition-all">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                  <Heart className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-stone-900 mb-2">Pastoral Empathy</h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Dedicated form teachers who know each child by name, understanding their individual learning rhythm.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-blue-50/60 border border-blue-200/60 flex flex-col justify-between hover:shadow-lg transition-all">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-stone-900 mb-2">Safe Campus</h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Clear school routines and good communication help families stay connected to their child&apos;s day.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-rose-50/60 border border-rose-200/60 flex flex-col justify-between hover:shadow-lg transition-all">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mb-4">
                  <Smile className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-stone-900 mb-2">Creative Expression</h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Music, dramatic play, pottery, and sports that help students find their unique voices.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ── 3. PARENT VOICES & COMMUNITY STORIES (Social Proof Centerpiece) ── */}
      <section className="py-20 lg:py-24 bg-[#F8F5EE] border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-xl mx-auto mb-16 space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-800">
              Parent Community
            </span>
            <h2 className="text-3xl font-black text-stone-900">
              Why Families Love {tenant.name}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-200/80 flex flex-col justify-between space-y-6">
              <Quote className="w-8 h-8 text-amber-500 fill-amber-100" />
              <p className="text-sm text-stone-700 leading-relaxed italic">
                &ldquo;Our daughter transformed from shy to confident within her first term. The teachers treat every child with extraordinary care and patience.&rdquo;
              </p>
              <div className="pt-4 border-t border-stone-100">
                <p className="font-bold text-xs text-stone-900">Mrs. Adebayo</p>
                <p className="text-[11px] text-stone-500">Primary 3 Parent</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-200/80 flex flex-col justify-between space-y-6">
              <Quote className="w-8 h-8 text-emerald-600 fill-emerald-100" />
              <p className="text-sm text-stone-700 leading-relaxed italic">
                &ldquo;The perfect blend of academic rigor and moral values. We love the weekly communication and transparency from the administration.&rdquo;
              </p>
              <div className="pt-4 border-t border-stone-100">
                <p className="font-bold text-xs text-stone-900">Engr. &amp; Dr. Okon</p>
                <p className="text-[11px] text-stone-500">Junior Secondary Parents</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-200/80 flex flex-col justify-between space-y-6">
              <Quote className="w-8 h-8 text-rose-500 fill-rose-100" />
              <p className="text-sm text-stone-700 leading-relaxed italic">
                &ldquo;Safe bus transportation, caring nurses, and an active outdoor playground. As working parents, we have total peace of mind every day.&rdquo;
              </p>
              <div className="pt-4 border-t border-stone-100">
                <p className="font-bold text-xs text-stone-900">Mr. &amp; Mrs. Nwosu</p>
                <p className="text-[11px] text-stone-500">Nursery 2 Parents</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 4. SOFT MASONRY CAMPUS GALLERY ── */}
      <section className="py-20 bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-800 block mb-2">
                Life on Campus
              </span>
              <h2 className="text-3xl font-black text-stone-900">
                Smiles, Friendships &amp; Milestones
              </h2>
            </div>
            <Link
              href="/gallery"
              className="mt-4 sm:mt-0 text-xs font-bold uppercase tracking-wider text-emerald-800 hover:text-emerald-950 flex items-center gap-1.5"
            >
              <span>View All Campus Photos ({gallery.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {gallery.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {gallery.slice(0, 3).map((img) => (
                <div
                  key={img.id}
                  className="rounded-3xl overflow-hidden border border-stone-200 bg-stone-100 shadow-sm hover:shadow-md transition-all aspect-4/3 relative group"
                >
                  <img
                    src={img.imageUrl}
                    alt={img.caption || 'Campus Life'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {img.caption && (
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-transparent to-transparent flex items-end p-4">
                      <p className="text-xs font-semibold text-white">{img.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* ── 5. WARM FAMILY INVITATION BANNER ── */}
      <section
        className="py-20 text-white relative overflow-hidden"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-xs font-bold tracking-widest uppercase text-amber-300">
            Admissions Now Open
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            Give Your Child The Best Start in Life
          </h2>
          <p className="text-sm sm:text-base text-emerald-100 max-w-xl mx-auto leading-relaxed">
            {admissions.text || 'Our admissions process is designed to be welcoming and supportive for both students and parents. We look forward to meeting your family.'}
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <Link
              href="/admissions"
              className="px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-stone-950 shadow-md transition-all"
            >
              Start Admission Process
            </Link>
            <Link
              href="/contact"
              className="px-7 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
            >
              Contact Admissions
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
