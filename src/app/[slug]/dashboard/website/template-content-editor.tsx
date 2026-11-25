'use client';

import React, { useState } from 'react';
import ImageUploadInput from '@/components/image-upload-input';
import { ChevronDown, ChevronUp, Layout, Plus, Trash2 } from 'lucide-react';

export interface TemplateContentEditorProps {
  templateId: 'heritage' | 'vanguard' | 'horizon';
  loading: boolean;
  onSwitchTemplate: () => void;
  onSave: () => void;

  heroTitle: string;
  setHeroTitle: (v: string) => void;
  heroMotto: string;
  setHeroMotto: (v: string) => void;
  heroSubtitle: string;
  setHeroSubtitle: (v: string) => void;
  heroImageUrl: string;
  setHeroImageUrl: (v: string) => void;

  foundedYear: string;
  setFoundedYear: (v: string) => void;
  teacherRatio: string;
  setTeacherRatio: (v: string) => void;
  passRate: string;
  setPassRate: (v: string) => void;

  highlightHeadline: string;
  setHighlightHeadline: (v: string) => void;
  highlightFeatureImage: string;
  setHighlightFeatureImage: (v: string) => void;
  highlightItems: Array<{ title: string; body: string }>;
  setHighlightItems: (v: Array<{ title: string; body: string }>) => void;

  headName: string;
  setHeadName: (v: string) => void;
  headPhotoUrl: string;
  setHeadPhotoUrl: (v: string) => void;
  campusPhotoUrl: string;
  setCampusPhotoUrl: (v: string) => void;
  principalMessage: string;
  setPrincipalMessage: (v: string) => void;
  aboutText: string;
  setAboutText: (v: string) => void;
  mission: string;
  setMission: (v: string) => void;
  vision: string;
  setVision: (v: string) => void;
  coreValues: string;
  setCoreValues: (v: string) => void;
  aboutAnthem: string;
  setAboutAnthem: (v: string) => void;

  academicsText: string;
  setAcademicsText: (v: string) => void;
  academicLevels: Array<{ name: string; ages: string; description: string; imageUrl?: string | null }>;
  setAcademicLevels: (v: Array<{ name: string; ages: string; description: string; imageUrl?: string | null }>) => void;
  academicHighlights: string;
  setAcademicHighlights: (v: string) => void;
  curricula: string;
  setCurricula: (v: string) => void;

  admissionsText: string;
  setAdmissionsText: (v: string) => void;
  admissionsRequirements: string;
  setAdmissionsRequirements: (v: string) => void;
  admissionsFeeGuide: string;
  setAdmissionsFeeGuide: (v: string) => void;

  newsEvents: Array<{ date: string; category: 'Event' | 'News'; title: string; summary?: string; imageUrl?: string | null }>;
  setNewsEvents: (v: Array<{ date: string; category: 'Event' | 'News'; title: string; summary?: string; imageUrl?: string | null }>) => void;

  parentQuoteText: string;
  setParentQuoteText: (v: string) => void;
  parentQuoteAuthor: string;
  setParentQuoteAuthor: (v: string) => void;
  parentQuoteRole: string;
  setParentQuoteRole: (v: string) => void;

  featuredStudentName: string;
  setFeaturedStudentName: (v: string) => void;
  featuredStudentClass: string;
  setFeaturedStudentClass: (v: string) => void;
  featuredStudentAchievement: string;
  setFeaturedStudentAchievement: (v: string) => void;
  featuredStudentImage: string;
  setFeaturedStudentImage: (v: string) => void;

  contactEmail: string;
  setContactEmail: (v: string) => void;
  contactPhone: string;
  setContactPhone: (v: string) => void;
  contactWhatsapp: string;
  setContactWhatsapp: (v: string) => void;
  contactAddress: string;
  setContactAddress: (v: string) => void;
  contactOfficeHours: string;
  setContactOfficeHours: (v: string) => void;
}

const TEMPLATE_META = {
  heritage: {
    name: 'Heritage (Editorial Classic)',
    summary: 'Showing sections in exact order of your Heritage layout: Hero → Stats Strip → From the Head → Academics Ledger → Admissions → News & Events → Contact.',
  },
  horizon: {
    name: 'Horizon (Modern Bento)',
    summary: 'Showing sections in exact order of your Horizon layout: Hero Card & Quick Stats → Bento Highlights → About Us → Academic Stages → Admissions → News & Events → Parent Quote → Contact.',
  },
  vanguard: {
    name: 'Vanguard (Warm Boutique)',
    summary: 'Showing sections in exact order of your Vanguard layout: Circular Hero → 4-Card Value Strip → About Us → Our Classes (with Photos) → Admissions → News & Events → Contact.',
  },
} as const;

export default function TemplateContentEditor(props: TemplateContentEditorProps) {
  const { templateId, loading, onSwitchTemplate, onSave } = props;
  const [showExtras, setShowExtras] = useState(false);

  const isHeritage = templateId === 'heritage';
  const isHorizon = templateId === 'horizon';
  const isVanguard = templateId === 'vanguard';
  const meta = TEMPLATE_META[templateId];

  let stepCounter = 0;
  const nextStep = () => {
    stepCounter += 1;
    return stepCounter;
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-8">
      {/* Active Template Context Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800">
              <Layout className="w-3 h-3" />
              Active Template: {meta.name}
            </span>
            <span className="text-[11px] text-slate-500">All edits stay saved if you switch templates later</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{meta.summary}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSwitchTemplate}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            Switch Template
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ─── SECTION 1: HERO (ALL TEMPLATES, TAILORED LABELS) ─── */}
      <div className="space-y-4">
        <div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
            {nextStep()}. {isHorizon ? 'Hero Card & Quick Stats' : isVanguard ? 'Hero Section (Circular Photo)' : 'Editorial Hero Banner (Arched Photo)'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isHeritage
              ? 'Top arched photo frame, serif headline with highlighted final word, and motto eyebrow.'
              : isHorizon
                ? 'Rounded tinted hero card with circular photo, highlighted headline word, and 3 quick metrics.'
                : 'Warm boutique hero with circular photo mask, wavy headline underline, and Now Enrolling badge.'}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Main Headline</label>
            <textarea
              rows={2}
              value={props.heroTitle}
              onChange={(e) => props.setHeroTitle(e.target.value)}
              placeholder="e.g. Welcome to Crestview International School"
              className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isHeritage ? 'Top Eyebrow / School Motto' : 'Top Pill Badge / Motto'}
            </label>
            <input
              type="text"
              value={props.heroMotto}
              onChange={(e) => props.setHeroMotto(e.target.value)}
              placeholder="e.g. Early Years · Primary · Secondary"
              className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Hero Subheading</label>
            <textarea
              rows={2}
              value={props.heroSubtitle}
              onChange={(e) => props.setHeroSubtitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
            />
          </div>
          <div className="md:col-span-2">
            <ImageUploadInput
              label={isHeritage ? 'Arched Hero Photo' : 'Circular Hero Photo'}
              value={props.heroImageUrl}
              onChange={props.setHeroImageUrl}
              endpoint="/api/tenant/upload"
              folder="hero"
              helperText={
                isHeritage
                  ? 'Displayed inside the arched hero frame on your Heritage homepage.'
                  : 'Automatically cropped into a clean circle with no rectangular overhang.'
              }
              recommendedDimensions="High-resolution photo up to 5MB"
              previewShape="landscape"
            />
          </div>

          {/* Horizon inline hero stats */}
          {isHorizon && (
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Founded Year</label>
                <input
                  type="text"
                  value={props.foundedYear}
                  onChange={(e) => props.setFoundedYear(e.target.value)}
                  placeholder="e.g. 2012"
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pupil–Teacher Ratio</label>
                <input
                  type="text"
                  value={props.teacherRatio}
                  onChange={(e) => props.setTeacherRatio(e.target.value)}
                  placeholder="e.g. 12:1"
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Success Rate</label>
                <input
                  type="text"
                  value={props.passRate}
                  onChange={(e) => props.setPassRate(e.target.value)}
                  placeholder="e.g. 98%"
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── HERITAGE ONLY: EDITORIAL STATS STRIP ─── */}
      {isHeritage && (
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
              {nextStep()}. Editorial Stats Strip
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              3-column hairline metrics strip directly below the Heritage hero.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Founded Year</label>
              <input
                type="text"
                value={props.foundedYear}
                onChange={(e) => props.setFoundedYear(e.target.value)}
                placeholder="e.g. 2012"
                className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pupil–Teacher Ratio</label>
              <input
                type="text"
                value={props.teacherRatio}
                onChange={(e) => props.setTeacherRatio(e.target.value)}
                placeholder="e.g. 12:1"
                className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Success Rate</label>
              <input
                type="text"
                value={props.passRate}
                onChange={(e) => props.setPassRate(e.target.value)}
                placeholder="e.g. 98%"
                className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── HORIZON ONLY: BENTO GRID (WHY FAMILIES CHOOSE US) ─── */}
      {isHorizon && (
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
              {nextStep()}. Why Families Choose Us (Bento Grid)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Edit the large colored Bento card, the white highlight card, and the bottom photo highlight card.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Main Bento Card Headline</label>
              <input
                type="text"
                value={props.highlightHeadline}
                onChange={(e) => props.setHighlightHeadline(e.target.value)}
                placeholder="e.g. Small classes, big attention."
                className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Main Bento Card Mission Copy</label>
              <textarea
                rows={2}
                value={props.mission}
                onChange={(e) => props.setMission(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
              />
            </div>
            <div className="md:col-span-2">
              <ImageUploadInput
                label="Bottom Bento Card Photo (Outdoors / Campus Activity Thumbnail)"
                value={props.highlightFeatureImage}
                onChange={props.setHighlightFeatureImage}
                endpoint="/api/tenant/upload"
                folder="highlights"
                helperText="Displayed in the rounded thumbnail on the right side of the bottom Bento card."
                previewShape="landscape"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((idx) => {
              const item = props.highlightItems[idx] || {
                title: idx === 0 ? 'An open door' : 'Outdoors, every day',
                body:
                  idx === 0
                    ? 'Direct, regular communication between teachers and parents every week.'
                    : 'Balanced academics, creative arts, sports, and practical discovery across every term.',
              };
              const updateSlot = (patch: Partial<{ title: string; body: string }>) => {
                const next = [...props.highlightItems];
                while (next.length <= idx) next.push({ title: '', body: '' });
                next[idx] = { ...item, ...patch };
                props.setHighlightItems(next);
              };
              return (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-600">
                    {idx === 0 ? 'Top-Right White Card' : 'Bottom-Right Photo Card'}
                  </span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateSlot({ title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-semibold border-slate-300 bg-white"
                  />
                  <textarea
                    rows={2}
                    value={item.body}
                    onChange={(e) => updateSlot({ body: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs border-slate-300 bg-white"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── VANGUARD ONLY: 4-CARD WAVY VALUE STRIP ─── */}
      {isVanguard && (
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
                {nextStep()}. 4-Card Wavy Value Strip
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                The 4 staggered pastel cards directly below your Vanguard hero.
              </p>
            </div>
            {props.highlightItems.length < 4 && (
              <button
                type="button"
                onClick={() => props.setHighlightItems([...props.highlightItems, { title: '', body: '' }])}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Card</span>
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {props.highlightItems.slice(0, 4).map((item, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-600">
                  Value Card {idx + 1}
                </span>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => {
                    const next = [...props.highlightItems];
                    next[idx] = { ...next[idx], title: e.target.value };
                    props.setHighlightItems(next);
                  }}
                  placeholder="Card title"
                  className="w-full px-3 py-2 border rounded-xl text-xs font-semibold border-slate-300 bg-white"
                />
                <textarea
                  rows={2}
                  value={item.body}
                  onChange={(e) => {
                    const next = [...props.highlightItems];
                    next[idx] = { ...next[idx], body: e.target.value };
                    props.setHighlightItems(next);
                  }}
                  placeholder="Short description..."
                  className="w-full px-3 py-2 border rounded-xl text-xs border-slate-300 bg-white"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── ABOUT & LEADERSHIP (TAILORED PER TEMPLATE) ─── */}
      <div className="space-y-4 pt-6 border-t border-slate-100">
        <div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
            {nextStep()}. {isHeritage ? 'From the Head & School Story' : 'About Us & Leadership'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isHeritage
              ? 'Featured on both your Heritage homepage ("From the Head") and your About page.'
              : 'Campus Story Photo appears on your homepage About section; Principal Portrait appears on your About page.'}
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ImageUploadInput
              label={isHeritage ? 'Head of School Portrait (Homepage & About Page)' : 'Principal / Head Portrait (About Page)'}
              value={props.headPhotoUrl}
              onChange={props.setHeadPhotoUrl}
              endpoint="/api/tenant/upload"
              folder="about"
              helperText={
                isHeritage
                  ? 'Displayed beside the Head’s italic welcome quote on your Heritage homepage.'
                  : 'Displayed in the organic portrait section on your About page.'
              }
              previewShape="square"
            />
            {!isHeritage && (
              <ImageUploadInput
                label="Campus Story Photo (Homepage About Section)"
                value={props.campusPhotoUrl}
                onChange={props.setCampusPhotoUrl}
                endpoint="/api/tenant/upload"
                folder="about"
                helperText="General campus or classroom photo displayed in the homepage About section."
                previewShape="landscape"
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Head of School Name &amp; Title</label>
              <input
                type="text"
                value={props.headName}
                onChange={(e) => props.setHeadName(e.target.value)}
                placeholder="e.g. Dr. Evelyn Vance, Head of School"
                className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Core Values {isHorizon ? '(Shown as checklist in About Us)' : '(Comma-separated)'}
              </label>
              <input
                type="text"
                value={props.coreValues}
                onChange={(e) => props.setCoreValues(e.target.value)}
                placeholder="e.g. Excellence, Integrity, Innovation, Empathy"
                className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Principal / Head Welcome Quote
            </label>
            <textarea
              rows={3}
              value={props.principalMessage}
              onChange={(e) => props.setPrincipalMessage(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">School Overview / Story</label>
            <textarea
              rows={3}
              value={props.aboutText}
              onChange={(e) => props.setAboutText(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
            />
          </div>

          {!isHorizon && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mission Statement</label>
              <textarea
                rows={2}
                value={props.mission}
                onChange={(e) => props.setMission(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── ACADEMICS / CLASSES / PROGRAMS ─── */}
      <div className="space-y-4 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
              {nextStep()}.{' '}
              {isVanguard
                ? 'Our Classes (with Class Photos)'
                : isHorizon
                  ? "Find Your Child's Place (Academic Programs)"
                  : 'Academics Ledger (01 / 02 / 03)'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isVanguard
                ? 'Add or edit each class card and upload a dedicated class photo.'
                : 'Edit the academic stages displayed on your homepage and Academics page.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              props.setAcademicLevels([
                ...props.academicLevels,
                { name: '', ages: '', description: '', imageUrl: '' },
              ])
            }
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stage</span>
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Academics Page Intro</label>
          <textarea
            rows={2}
            value={props.academicsText}
            onChange={(e) => props.setAcademicsText(e.target.value)}
            className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
          />
        </div>

        <div className="space-y-3">
          {props.academicLevels.map((lvl, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  Stage {String(idx + 1).padStart(2, '0')}
                </span>
                <button
                  type="button"
                  onClick={() => props.setAcademicLevels(props.academicLevels.filter((_, i) => i !== idx))}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                  title="Remove stage"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={lvl.name}
                  onChange={(e) => {
                    const next = [...props.academicLevels];
                    next[idx] = { ...next[idx], name: e.target.value };
                    props.setAcademicLevels(next);
                  }}
                  placeholder="e.g. Early Years & Nursery"
                  className="w-full px-3 py-2 border rounded-xl text-xs font-semibold border-slate-300 bg-white"
                />
                <input
                  type="text"
                  value={lvl.ages}
                  onChange={(e) => {
                    const next = [...props.academicLevels];
                    next[idx] = { ...next[idx], ages: e.target.value };
                    props.setAcademicLevels(next);
                  }}
                  placeholder="e.g. Ages 2 – 5"
                  className="w-full px-3 py-2 border rounded-xl text-xs border-slate-300 bg-white"
                />
              </div>
              <textarea
                rows={2}
                value={lvl.description}
                onChange={(e) => {
                  const next = [...props.academicLevels];
                  next[idx] = { ...next[idx], description: e.target.value };
                  props.setAcademicLevels(next);
                }}
                placeholder="Short description of this stage..."
                className="w-full px-3 py-2 border rounded-xl text-xs border-slate-300 bg-white"
              />
              {isVanguard && (
                <ImageUploadInput
                  label="Class Card Photo (Optional)"
                  value={lvl.imageUrl || ''}
                  onChange={(url) => {
                    const next = [...props.academicLevels];
                    next[idx] = { ...next[idx], imageUrl: url };
                    props.setAcademicLevels(next);
                  }}
                  endpoint="/api/tenant/upload"
                  folder="academics"
                  helperText="Displayed at the top of this class card on your Vanguard homepage."
                  previewShape="landscape"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── ADMISSIONS ─── */}
      <div className="space-y-4 pt-6 border-t border-slate-100">
        <div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
            {nextStep()}. Admissions &amp; Enrollment
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Powers the deep colored Admissions band on your homepage and the full Admissions page.
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Admissions Callout Text</label>
            <textarea
              rows={2}
              value={props.admissionsText}
              onChange={(e) => props.setAdmissionsText(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admission Requirements (One per line)
              </label>
              <textarea
                rows={3}
                value={props.admissionsRequirements}
                onChange={(e) => props.setAdmissionsRequirements(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-xs font-mono border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tuition &amp; Fee Policy Note</label>
              <textarea
                rows={3}
                value={props.admissionsFeeGuide}
                onChange={(e) => props.setAdmissionsFeeGuide(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── NEWS & EVENTS ─── */}
      <div className="space-y-4 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
              {nextStep()}. News &amp; Events ({props.newsEvents.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upcoming dates and announcements displayed in the News &amp; events section.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              props.setNewsEvents([
                ...props.newsEvents,
                { date: 'New', category: 'Event', title: '', summary: '' },
              ])
            }
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        </div>
        <div className="space-y-3">
          {props.newsEvents.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                <input
                  type="text"
                  value={item.date}
                  onChange={(e) => {
                    const next = [...props.newsEvents];
                    next[idx] = { ...next[idx], date: e.target.value };
                    props.setNewsEvents(next);
                  }}
                  placeholder="20 Jun"
                  className="md:col-span-2 px-3 py-2 border rounded-xl text-xs border-slate-300 bg-white"
                />
                <select
                  value={item.category}
                  onChange={(e) => {
                    const next = [...props.newsEvents];
                    next[idx] = { ...next[idx], category: e.target.value as 'Event' | 'News' };
                    props.setNewsEvents(next);
                  }}
                  className="md:col-span-2 px-3 py-2 border rounded-xl text-xs border-slate-300 bg-white"
                >
                  <option value="Event">Event</option>
                  <option value="News">News</option>
                </select>
                <div className="md:col-span-7 space-y-2">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => {
                      const next = [...props.newsEvents];
                      next[idx] = { ...next[idx], title: e.target.value };
                      props.setNewsEvents(next);
                    }}
                    placeholder="Event or announcement title"
                    className="w-full px-3 py-2 border rounded-xl text-xs font-medium border-slate-300 bg-white"
                  />
                  <input
                    type="text"
                    value={item.summary || ''}
                    onChange={(e) => {
                      const next = [...props.newsEvents];
                      next[idx] = { ...next[idx], summary: e.target.value };
                      props.setNewsEvents(next);
                    }}
                    placeholder="Short one-line summary (optional)"
                    className="w-full px-3 py-2 border rounded-xl text-xs border-slate-300 bg-white"
                  />
                </div>
                <div className="md:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => props.setNewsEvents(props.newsEvents.filter((_, i) => i !== idx))}
                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <ImageUploadInput
                label={
                  isHeritage && idx === 0
                    ? 'Featured Event Photo (Homepage & News Page)'
                    : isHorizon
                      ? 'Event / News Photo (Homepage Card & News Page)'
                      : 'Event / News Photo (Optional — shown on News & Events page)'
                }
                value={item.imageUrl || ''}
                onChange={(url) => {
                  const next = [...props.newsEvents];
                  next[idx] = { ...next[idx], imageUrl: url };
                  props.setNewsEvents(next);
                }}
                endpoint="/api/tenant/upload"
                folder="news"
                previewShape="landscape"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ─── HORIZON ONLY: PARENT TESTIMONIAL BANNER ─── */}
      {isHorizon && (
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
              {nextStep()}. Parent Testimonial Banner
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Warm tinted quote banner right above the curved footer on your Horizon homepage.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <textarea
              rows={2}
              value={props.parentQuoteText}
              onChange={(e) => props.setParentQuoteText(e.target.value)}
              placeholder="A short quote from a parent about what changed for their child..."
              className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300 bg-white"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={props.parentQuoteAuthor}
                onChange={(e) => props.setParentQuoteAuthor(e.target.value)}
                placeholder="Parent name"
                className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300 bg-white"
              />
              <input
                type="text"
                value={props.parentQuoteRole}
                onChange={(e) => props.setParentQuoteRole(e.target.value)}
                placeholder="Role (e.g. Parent of a Year 5 pupil)"
                className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTACT & WHATSAPP ─── */}
      <div className="space-y-4 pt-6 border-t border-slate-100">
        <div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-600">
            {nextStep()}. Contact Details &amp; Footer WhatsApp
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
            <input
              type="email"
              value={props.contactEmail}
              onChange={(e) => props.setContactEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
            <input
              type="text"
              value={props.contactPhone}
              onChange={(e) => props.setContactPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              WhatsApp Number (Powers the footer &ldquo;Chat on WhatsApp&rdquo; button)
            </label>
            <input
              type="text"
              value={props.contactWhatsapp}
              onChange={(e) => props.setContactWhatsapp(e.target.value)}
              placeholder="e.g. +234 800 000 0000 or +44 7700 900077"
              className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Campus Physical Address</label>
            <input
              type="text"
              value={props.contactAddress}
              onChange={(e) => props.setContactAddress(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Office Hours</label>
            <input
              type="text"
              value={props.contactOfficeHours}
              onChange={(e) => props.setContactOfficeHours(e.target.value)}
              placeholder="e.g. Monday – Friday: 7:30 AM – 4:30 PM"
              className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
            />
          </div>
        </div>
      </div>

      {/* ─── COLLAPSIBLE OPTIONAL EXTRAS & INNER PAGES ─── */}
      <div className="pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setShowExtras(!showExtras)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-left transition-colors cursor-pointer"
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Inner Pages &amp; Optional Spotlights
            </span>
            <p className="text-[11px] text-slate-500">
              Scholar of the Term spotlight, Vision statement, School Anthem, and Curricula frameworks list.
            </p>
          </div>
          {showExtras ? (
            <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
          )}
        </button>

        {showExtras && (
          <div className="mt-4 p-5 rounded-2xl border border-slate-200/80 space-y-6">
            {/* Featured Student */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Scholar of the Term (Optional Homepage Spotlight)
                </h4>
                {props.featuredStudentName && (
                  <button
                    type="button"
                    onClick={() => {
                      props.setFeaturedStudentName('');
                      props.setFeaturedStudentClass('');
                      props.setFeaturedStudentAchievement('');
                      props.setFeaturedStudentImage('');
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                  >
                    Disable Spotlight
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={props.featuredStudentName}
                  onChange={(e) => props.setFeaturedStudentName(e.target.value)}
                  placeholder="Student Name"
                  maxLength={100}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
                <input
                  value={props.featuredStudentClass}
                  onChange={(e) => props.setFeaturedStudentClass(e.target.value)}
                  placeholder="Class / Year"
                  maxLength={80}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
                <textarea
                  value={props.featuredStudentAchievement}
                  onChange={(e) => props.setFeaturedStudentAchievement(e.target.value)}
                  placeholder="Achievement description..."
                  maxLength={300}
                  rows={2}
                  className="md:col-span-2 w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
                <div className="md:col-span-2">
                  <ImageUploadInput
                    label="Student Photo"
                    value={props.featuredStudentImage}
                    onChange={props.setFeaturedStudentImage}
                    endpoint="/api/tenant/upload"
                    folder="gallery"
                    previewShape="square"
                  />
                </div>
              </div>
            </div>

            {/* Vision & Anthem */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vision Statement (About Page)</label>
                <textarea
                  rows={3}
                  value={props.vision}
                  onChange={(e) => props.setVision(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">School Anthem Lyrics (About Page)</label>
                <textarea
                  rows={3}
                  value={props.aboutAnthem}
                  onChange={(e) => props.setAboutAnthem(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm border-slate-300"
                />
              </div>
            </div>

            {/* Curricula & Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Curricula Frameworks (Academics Page — one per line)
                </label>
                <textarea
                  rows={3}
                  value={props.curricula}
                  onChange={(e) => props.setCurricula(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-mono border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Curriculum Highlights (One per line)
                </label>
                <textarea
                  rows={3}
                  value={props.academicHighlights}
                  onChange={(e) => props.setAcademicHighlights(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-mono border-slate-300"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Save Button */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Saving...' : 'Save All Website Content'}
        </button>
      </div>
    </div>
  );
}
