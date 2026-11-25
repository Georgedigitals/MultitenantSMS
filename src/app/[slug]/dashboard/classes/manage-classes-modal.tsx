'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Globe,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

interface ManagedClassItem {
  id: string;
  name: string;
  orderIndex: number;
}

interface PresetOption {
  key: string;
  label: string;
  region: string;
  count: number;
  sample: string;
}

interface ManageClassesModalProps {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function ManageClassesModal({ open, onClose, onChanged }: ManageClassesModalProps) {
  const [classes, setClasses] = useState<ManagedClassItem[]>([]);
  const [presets, setPresets] = useState<PresetOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newClassName, setNewClassName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  const loadClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tenant/classes');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load classes');
      setClasses(data.classes || []);
      setPresets(data.presets || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadClasses();
      setSuccess(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newClassName.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/tenant/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add class');
      setNewClassName('');
      setSuccess(`Added "${clean}" to your school classes.`);
      await loadClasses();
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to add class');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string) => {
    const clean = editingName.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/tenant/classes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not rename class');
      setEditingId(null);
      setSuccess(`Renamed class to "${clean}".`);
      await loadClasses();
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to rename class');
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= classes.length) return;
    const reordered = [...classes];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setClasses(reordered);

    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/tenant/classes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: reordered.map((c) => c.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reorder classes');
      await loadClasses();
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to reorder classes');
      await loadClasses();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (cls: ManagedClassItem) => {
    if (!confirm(`Delete "${cls.name}"? This only works if no students, fees, or exams are linked to it.`)) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/tenant/classes?id=${encodeURIComponent(cls.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete class');
      setSuccess(`Deleted "${cls.name}".`);
      await loadClasses();
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete class');
    } finally {
      setBusy(false);
    }
  };

  const handleApplyPreset = async (presetKey: string, label: string) => {
    if (!confirm(`Replace your current classes with the "${label}" starter list?`)) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/tenant/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply_preset', presetKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not apply preset');
      setShowPresets(false);
      setSuccess(`Applied "${label}" class structure.`);
      await loadClasses();
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to apply preset');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Manage School Classes &amp; Grades</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Add any class name your country uses, rename existing ones, or reorder the promotion sequence.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
              {success}
            </div>
          )}

          {/* Add Custom Class Form */}
          <form onSubmit={handleAddClass} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="e.g. Creche, Reception, Grade 1, Form 1, Year 7, A-Level..."
              maxLength={60}
              className="flex-1 h-10 px-3.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
            />
            <button
              type="submit"
              disabled={busy || !newClassName.trim()}
              className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Class</span>
            </button>
          </form>

          {/* Country / Curriculum Presets Toggle */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Globe className="w-4 h-4 text-slate-500" />
                <span>Load a country / curriculum starter preset</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPresets(!showPresets)}
                className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                {showPresets ? 'Hide presets' : 'Choose preset'}
              </button>
            </div>

            {showPresets && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {presets
                  .filter((p) => p.count > 0)
                  .map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      disabled={busy}
                      onClick={() => handleApplyPreset(p.key, p.label)}
                      className="text-left p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <p className="text-xs font-bold text-slate-900">{p.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{p.sample}…</p>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Current Classes List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <span>Promotion Order ({classes.length} classes)</span>
              <span>Top = Entry · Bottom = Graduating</span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading classes…</div>
            ) : classes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                No classes yet. Add your first class above or pick a country preset.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {classes.map((cls, idx) => {
                  const isEditing = editingId === cls.id;
                  return (
                    <div
                      key={cls.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-6 text-center text-[11px] font-mono font-semibold text-slate-400 shrink-0">
                          {idx + 1}
                        </span>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleRename(cls.id);
                                }
                              }}
                              autoFocus
                              className="flex-1 h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-900"
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleRename(cls.id)}
                              className="h-8 px-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="h-8 px-2 rounded-lg border border-slate-200 text-slate-500 text-xs cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {cls.name}
                          </span>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={busy || idx === 0}
                            onClick={() => handleMove(idx, -1)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            title="Move up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busy || idx === classes.length - 1}
                            onClick={() => handleMove(idx, 1)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            title="Move down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setEditingId(cls.id);
                              setEditingName(cls.name);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                            title="Rename class"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDelete(cls)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                            title="Delete class"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
