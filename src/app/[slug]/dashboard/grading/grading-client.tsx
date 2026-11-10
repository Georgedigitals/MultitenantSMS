'use client';

import React, { useState } from 'react';

interface ComponentItem {
  id?: string;
  name: string;
  maxScore: number;
  weightPercent: number;
  orderIndex: number;
}

interface ScaleItem {
  id?: string;
  lowestClassLevelId: string;
  highestClassLevelId: string;
  lowestClassLevel?: { name: string; orderIndex: number };
  highestClassLevel?: { name: string; orderIndex: number };
  minScore: number;
  maxScore: number;
  grade: string;
  remark: string;
}

interface ClassLevelOption {
  id: string;
  name: string;
  orderIndex: number;
}

interface GradingClientProps {
  slug: string;
  canCustomize: boolean;
  initialComponents: ComponentItem[];
  initialScales: ScaleItem[];
  classLevels: ClassLevelOption[];
  terms: Array<{ id: string; name: string }>;
  currentTermId?: string;
  isLocked: boolean;
}

export default function GradingClient({
  slug,
  canCustomize,
  initialComponents,
  initialScales,
  classLevels,
  terms,
  currentTermId,
  isLocked,
}: GradingClientProps) {
  const [components, setComponents] = useState<ComponentItem[]>(
    initialComponents.map((c) => ({
      ...c,
      maxScore: Number(c.maxScore),
      weightPercent: Number(c.weightPercent),
    }))
  );
  const [scales, setScales] = useState<ScaleItem[]>(
    initialScales.map((s) => ({
      ...s,
      minScore: Number(s.minScore),
      maxScore: Number(s.maxScore),
    }))
  );

  const [selectedTermId, setSelectedTermId] = useState<string>(currentTermId || '');
  const [compMessage, setCompMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [scaleMessage, setScaleMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [savingComp, setSavingComp] = useState(false);
  const [savingScale, setSavingScale] = useState(false);

  const totalWeight = components.reduce((acc, c) => acc + (Number(c.weightPercent) || 0), 0);

  const handleComponentChange = (index: number, field: keyof ComponentItem, value: any) => {
    const updated = [...components];
    updated[index] = { ...updated[index], [field]: value };
    setComponents(updated);
  };

  const addComponent = () => {
    setComponents([
      ...components,
      {
        name: `CA ${components.length + 1}`,
        maxScore: 20,
        weightPercent: 10,
        orderIndex: components.length + 1,
      },
    ]);
  };

  const removeComponent = (index: number) => {
    if (components.length <= 1) return;
    setComponents(components.filter((_, i) => i !== index));
  };

  const saveComponents = async () => {
    setSavingComp(true);
    setCompMessage(null);
    try {
      const res = await fetch('/api/tenant/assessment-components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          termId: selectedTermId || null,
          components,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCompMessage({ text: data.error || 'Failed to save assessment components', error: true });
      } else {
        setCompMessage({ text: 'Assessment components updated successfully!', error: false });
        if (data.components) {
          setComponents(
            data.components.map((c: any) => ({
              ...c,
              maxScore: Number(c.maxScore),
              weightPercent: Number(c.weightPercent),
            }))
          );
        }
      }
    } catch {
      setCompMessage({ text: 'Network error occurred', error: true });
    } finally {
      setSavingComp(false);
    }
  };

  const handleScaleChange = (index: number, field: keyof ScaleItem, value: any) => {
    const updated = [...scales];
    updated[index] = { ...updated[index], [field]: value };
    setScales(updated);
  };

  const addScale = () => {
    const lowestId = classLevels[0]?.id || '';
    const highestId = classLevels[classLevels.length - 1]?.id || '';
    setScales([
      ...scales,
      {
        lowestClassLevelId: lowestId,
        highestClassLevelId: highestId,
        minScore: 0,
        maxScore: 40,
        grade: 'G',
        remark: 'Unsatisfactory',
      },
    ]);
  };

  const removeScale = (index: number) => {
    if (scales.length <= 1) return;
    setScales(scales.filter((_, i) => i !== index));
  };

  const saveScales = async () => {
    setSavingScale(true);
    setScaleMessage(null);
    try {
      const res = await fetch('/api/tenant/grading-scales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          scales,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScaleMessage({ text: data.error || 'Failed to save grading scales', error: true });
      } else {
        setScaleMessage({ text: 'Grading scales updated successfully!', error: false });
        if (data.scales) {
          setScales(
            data.scales.map((s: any) => ({
              ...s,
              minScore: Number(s.minScore),
              maxScore: Number(s.maxScore),
            }))
          );
        }
      }
    } catch {
      setScaleMessage({ text: 'Network error occurred', error: true });
    } finally {
      setSavingScale(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Plan Feature Notice */}
      {!canCustomize && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
          <div className="text-amber-500 mt-0.5">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-amber-900">Standard Assessment & Grading Mode</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              Your school is running on the standard curriculum grading schema. Customizing score component weights
              and grading bands is an Enterprise tier capability. Contact platform support to enable custom grading scales.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 1: Assessment Structure */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assessment Components & Weighting</h2>
            <p className="text-xs text-slate-500 mt-1">
              Configure per-term score breakdown (Continuous Assessment tests and Examinations).
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {terms.length > 0 && (
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-500 font-medium">Scope:</span>
                <select
                  value={selectedTermId}
                  onChange={(e) => setSelectedTermId(e.target.value)}
                  className="rounded-lg border-slate-300 text-xs px-2.5 py-1.5 bg-slate-50 focus:bg-white"
                >
                  <option value="">Default (All Terms)</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {isLocked && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                Term Locked
              </span>
            )}
          </div>
        </div>

        <div className="p-6">
          {compMessage && (
            <div
              className={`mb-4 p-3 rounded-lg text-xs font-medium ${
                compMessage.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {compMessage.text}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Component Name</th>
                  <th className="py-3 px-4">Max Score</th>
                  <th className="py-3 px-4">Weight %</th>
                  {canCustomize && !isLocked && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {components.map((c, idx) => (
                  <tr key={c.id || idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 text-slate-500 font-medium">{idx + 1}</td>
                    <td className="py-3 px-4">
                      {canCustomize && !isLocked ? (
                        <input
                          type="text"
                          value={c.name}
                          onChange={(e) => handleComponentChange(idx, 'name', e.target.value)}
                          className="w-full max-w-xs px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="font-semibold text-slate-900">{c.name}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {canCustomize && !isLocked ? (
                        <input
                          type="number"
                          value={c.maxScore}
                          onChange={(e) => handleComponentChange(idx, 'maxScore', Number(e.target.value))}
                          className="w-24 px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:border-blue-500"
                        />
                      ) : (
                        <span className="text-slate-700 font-medium">{c.maxScore}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {canCustomize && !isLocked ? (
                        <input
                          type="number"
                          value={c.weightPercent}
                          onChange={(e) => handleComponentChange(idx, 'weightPercent', Number(e.target.value))}
                          className="w-24 px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:border-blue-500"
                        />
                      ) : (
                        <span className="text-slate-700 font-medium">{c.weightPercent}%</span>
                      )}
                    </td>
                    {canCustomize && !isLocked && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => removeComponent(idx)}
                          disabled={components.length <= 1}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-30"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-semibold text-slate-700">Total Weight: </span>
              <span
                className={`font-bold ${
                  Math.abs(totalWeight - 100) < 0.01 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {totalWeight}%
              </span>
              {Math.abs(totalWeight - 100) >= 0.01 && (
                <span className="text-red-500 ml-2">(Weights must sum exactly to 100%)</span>
              )}
            </div>

            {canCustomize && !isLocked && (
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={addComponent}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  + Add Component
                </button>
                <button
                  type="button"
                  onClick={saveComponents}
                  disabled={savingComp || Math.abs(totalWeight - 100) >= 0.01}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingComp ? 'Saving...' : 'Save Structure'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: Grading Scale */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Grading Scale & Remarks</h2>
            <p className="text-xs text-slate-500 mt-1">
              Score ranges mapping to letter grades and standard report remarks, scoped by class-level band.
            </p>
          </div>
        </div>

        <div className="p-6">
          {scaleMessage && (
            <div
              className={`mb-4 p-3 rounded-lg text-xs font-medium ${
                scaleMessage.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {scaleMessage.text}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Score Range</th>
                  <th className="py-3 px-4">Grade</th>
                  <th className="py-3 px-4">Remark</th>
                  <th className="py-3 px-4">Class Level Band</th>
                  {canCustomize && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scales.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono text-xs">
                      {canCustomize ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            value={s.minScore}
                            onChange={(e) => handleScaleChange(idx, 'minScore', Number(e.target.value))}
                            className="w-16 px-2 py-1 text-xs rounded border border-slate-300"
                          />
                          <span>–</span>
                          <input
                            type="number"
                            value={s.maxScore}
                            onChange={(e) => handleScaleChange(idx, 'maxScore', Number(e.target.value))}
                            className="w-16 px-2 py-1 text-xs rounded border border-slate-300"
                          />
                        </div>
                      ) : (
                        <span className="font-semibold text-slate-800">
                          {s.minScore} – {s.maxScore}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {canCustomize ? (
                        <input
                          type="text"
                          value={s.grade}
                          onChange={(e) => handleScaleChange(idx, 'grade', e.target.value)}
                          className="w-16 px-2 py-1 text-xs font-bold rounded border border-slate-300"
                        />
                      ) : (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs">
                          {s.grade}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {canCustomize ? (
                        <input
                          type="text"
                          value={s.remark}
                          onChange={(e) => handleScaleChange(idx, 'remark', e.target.value)}
                          className="w-full max-w-xs px-2 py-1 text-xs rounded border border-slate-300"
                        />
                      ) : (
                        <span className="text-slate-700 font-medium">{s.remark}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {canCustomize ? (
                        <div className="flex items-center space-x-1">
                          <select
                            value={s.lowestClassLevelId}
                            onChange={(e) => handleScaleChange(idx, 'lowestClassLevelId', e.target.value)}
                            className="text-xs rounded border-slate-300 px-2 py-1"
                          >
                            {classLevels.map((cl) => (
                              <option key={cl.id} value={cl.id}>
                                {cl.name}
                              </option>
                            ))}
                          </select>
                          <span>to</span>
                          <select
                            value={s.highestClassLevelId}
                            onChange={(e) => handleScaleChange(idx, 'highestClassLevelId', e.target.value)}
                            className="text-xs rounded border-slate-300 px-2 py-1"
                          >
                            {classLevels.map((cl) => (
                              <option key={cl.id} value={cl.id}>
                                {cl.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span>
                          {s.lowestClassLevel?.name || 'All'} – {s.highestClassLevel?.name || 'All'}
                        </span>
                      )}
                    </td>
                    {canCustomize && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => removeScale(idx)}
                          disabled={scales.length <= 1}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-30"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canCustomize && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={addScale}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                + Add Grade Band
              </button>
              <button
                type="button"
                onClick={saveScales}
                disabled={savingScale}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingScale ? 'Saving...' : 'Save Grading Scale'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
