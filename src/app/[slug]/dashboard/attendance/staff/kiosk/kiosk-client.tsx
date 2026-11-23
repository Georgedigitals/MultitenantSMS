'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ScanLine,
  Grid3X3,
  Clock,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Minimize2,
  ArrowLeft,
  User,
  LogOut,
  LogIn,
  RefreshCw,
  Sparkles,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react';

interface KioskClientProps {
  slug: string;
  schoolName: string;
  logoUrl: string | null;
  workStartTime: string;
  lateThresholdTime: string;
  standalone?: boolean;
}

export default function KioskClient({
  slug,
  schoolName,
  logoUrl,
  workStartTime,
  lateThresholdTime,
  standalone = false,
}: KioskClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pin' | 'qr'>('pin');
  const [mounted, setMounted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [pin, setPin] = useState<string>('');
  const [qrInput, setQrInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verifiedStaff, setVerifiedStaff] = useState<any | null>(null);
  const [confirmation, setConfirmation] = useState<{
    action: string;
    message: string;
    isLate?: boolean;
    minutesLate?: number;
    timestamp: string;
  } | null>(null);

  // Protected Admin Exit State
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [exitError, setExitError] = useState<string | null>(null);
  const [verifyingExit, setVerifyingExit] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // Keep digital clock updating every second after mounting on client
  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Web Audio chime for successful clock-in
  const playSuccessChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch {
      // AudioContext may be blocked before first user gesture
    }
  };

  // Reset to idle screen after confirmation countdown
  useEffect(() => {
    if (confirmation) {
      setCountdown(4);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            resetTerminal();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [confirmation]);

  const resetTerminal = () => {
    setPin('');
    setQrInput('');
    setErrorMsg(null);
    setVerifiedStaff(null);
    setConfirmation(null);
    setCountdown(null);
    if (activeTab === 'qr') {
      setTimeout(() => qrInputRef.current?.focus(), 200);
    }
  };

  // Numeric keypad inputs
  const handleKeypadPress = (val: string) => {
    if (loading || confirmation) return;
    setErrorMsg(null);

    if (val === 'clear') {
      setPin('');
      setVerifiedStaff(null);
      return;
    }

    if (val === 'backspace') {
      setPin((prev) => prev.slice(0, -1));
      setVerifiedStaff(null);
      return;
    }

    if (pin.length < 6) {
      const nextPin = pin + val;
      setPin(nextPin);
      if (nextPin.length >= 4) {
        verifyCredentials(nextPin, undefined);
      }
    }
  };

  // Verify PIN or QR with server
  const verifyCredentials = async (pinValue?: string, qrValue?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/tenant/attendance/staff/kiosk-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          pin: pinValue || undefined,
          qrCode: qrValue || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Invalid credentials');
      }

      setVerifiedStaff(json);

      // If auto-clock is enabled or user scanned QR, we can clock in directly
      if (qrValue) {
        const isClockedIn = !!json.todayRecord?.clockInTime;
        const targetAction = isClockedIn ? 'clock_out' : 'clock_in';
        await executeClockAction(json.staff.id, targetAction, 'kiosk_qr');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Staff verification failed');
      setVerifiedStaff(null);
    } finally {
      setLoading(false);
    }
  };

  // Execute Clock In or Clock Out
  const executeClockAction = async (staffId: string, action: 'clock_in' | 'clock_out', method: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/tenant/attendance/staff/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          staffId,
          action,
          method,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Clock operation failed');
      }

      playSuccessChime();
      setConfirmation({
        action,
        message: json.message,
        isLate: json.status === 'late',
        minutesLate: json.minutesLate,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAdminExit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPinInput.trim()) return;
    setVerifyingExit(true);
    setExitError(null);
    try {
      const res = await fetch('/api/tenant/attendance/staff/kiosk-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          action: 'verify_admin_exit',
          adminPin: adminPinInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      router.push(`/${slug}/dashboard/attendance/staff`);
    } catch (err: any) {
      setExitError(err.message || 'Incorrect Admin PIN or password.');
    } finally {
      setVerifyingExit(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const formattedDate = mounted
    ? currentTime.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const formattedTime = mounted
    ? currentTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-hidden font-sans">
      {/* Background Subtle Gradient Accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={schoolName} className="w-10 h-10 object-contain rounded-lg bg-white/5 p-1" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-md">
              {schoolName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="font-extrabold text-white text-base tracking-tight leading-none">{schoolName}</h1>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Staff Attendance Terminal • Resumption: {workStartTime} (Late after {lateThresholdTime})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Protected Exit (hidden in standalone kiosk mode) */}
          {!standalone && (
            <button
              onClick={() => setIsExitModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 text-xs font-bold transition-colors cursor-pointer"
              title="Protected Admin Exit"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Exit Terminal</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Center Stage */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 z-10 max-w-xl mx-auto w-full">
        {/* Large Digital Clock */}
        <div className="text-center mb-6">
          <div
            suppressHydrationWarning
            className="text-5xl sm:text-6xl font-black tracking-tight text-white font-mono drop-shadow-md min-h-[1.2em]"
          >
            {mounted ? formattedTime : '\u00A0'}
          </div>
          <div
            suppressHydrationWarning
            className="text-sm font-semibold text-slate-400 mt-1 min-h-[1.25rem]"
          >
            {mounted ? formattedDate : '\u00A0'}
          </div>
        </div>

        {/* Success Confirmation State */}
        {confirmation ? (
          <div className="w-full bg-slate-900 border border-emerald-500/40 rounded-3xl p-8 shadow-2xl text-center space-y-5 animate-scale-up">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 ${
                  confirmation.isLate
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {confirmation.action === 'clock_out' ? 'Departure Confirmed' : confirmation.isLate ? 'Late Arrival' : 'On-Time Arrival'}
              </span>
              <h2 className="text-2xl font-black text-white">{confirmation.message}</h2>
              <p className="text-xs text-slate-400 mt-1">Logged at {confirmation.timestamp}</p>
            </div>

            <div className="pt-2 text-xs text-slate-500">
              Terminal resetting in <span className="font-bold text-white font-mono">{countdown}</span> seconds for next teacher...
            </div>

            <button
              onClick={resetTerminal}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
            >
              Done / Next Teacher
            </button>
          </div>
        ) : (
          /* Input Container */
          <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-6">
            {/* Mode Switch Tabs */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800/80">
              <button
                onClick={() => {
                  setActiveTab('pin');
                  resetTerminal();
                }}
                className={`py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'pin'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                <span>Enter 4-Digit PIN</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('qr');
                  resetTerminal();
                }}
                className={`py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'qr'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ScanLine className="w-4 h-4" />
                <span>Scan ID Badge</span>
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Staff Card when PIN matched */}
            {verifiedStaff && (
              <div className="p-4 bg-slate-800/80 border border-blue-500/30 rounded-2xl flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30 flex items-center justify-center font-bold">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-extrabold text-white text-sm">{verifiedStaff.staff.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {verifiedStaff.staff.staffCode} • <span className="capitalize">{verifiedStaff.staff.roleBase}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!verifiedStaff.todayRecord?.clockInTime ? (
                    <button
                      onClick={() => executeClockAction(verifiedStaff.staff.id, 'clock_in', 'kiosk_pin')}
                      disabled={loading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Clock In</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => executeClockAction(verifiedStaff.staff.id, 'clock_out', 'kiosk_pin')}
                      disabled={loading}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Clock Out</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TAB 1: 4-DIGIT PIN KEYPAD */}
            {activeTab === 'pin' && (
              <div className="space-y-4">
                {/* PIN Display */}
                <div className="flex items-center justify-center gap-3 py-2">
                  {[0, 1, 2, 3].map((idx) => {
                    const filled = pin.length > idx;
                    return (
                      <div
                        key={idx}
                        className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-mono font-black transition-all ${
                          filled
                            ? 'border-blue-500 bg-blue-600/20 text-blue-300 shadow-inner'
                            : 'border-slate-800 bg-slate-950 text-slate-700'
                        }`}
                      >
                        {filled ? '•' : ''}
                      </div>
                    );
                  })}
                </div>

                {/* 3x4 Tactile Keypad */}
                <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((key) => {
                    const isSpecial = key === 'clear' || key === 'backspace';
                    return (
                      <button
                        key={key}
                        onClick={() => handleKeypadPress(key)}
                        disabled={loading}
                        className={`h-14 rounded-2xl font-extrabold text-lg flex items-center justify-center transition-all active:scale-95 border ${
                          isSpecial
                            ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 text-xs uppercase tracking-wider'
                            : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-white shadow-xs'
                        }`}
                      >
                        {key === 'clear' ? 'Clear' : key === 'backspace' ? '⌫' : key}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: QR BADGE SCANNER */}
            {activeTab === 'qr' && (
              <div className="space-y-4 text-center">
                {/* Target Frame Animation */}
                <div className="relative w-64 h-64 mx-auto rounded-3xl border-2 border-dashed border-blue-500/50 bg-slate-950 flex flex-col items-center justify-center p-6 overflow-hidden">
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-laser" />
                  <ScanLine className="w-16 h-16 text-blue-500/40 mb-3 animate-pulse" />
                  <p className="text-xs font-bold text-slate-300">Present Staff Badge to Camera</p>
                  <p className="text-[10px] text-slate-500 mt-1">Or scan with barcode scanner</p>
                </div>

                {/* Hardware Barcode / USB Scanner listener input */}
                <div className="max-w-xs mx-auto">
                  <input
                    ref={qrInputRef}
                    type="text"
                    placeholder="Scan or enter Staff Code..."
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && qrInput.trim()) {
                        verifyCredentials(undefined, qrInput.trim());
                      }
                    }}
                    autoFocus
                    className="w-full text-center px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    onClick={() => qrInput.trim() && verifyCredentials(undefined, qrInput.trim())}
                    disabled={loading || !qrInput.trim()}
                    className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    Submit Code
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-xs text-slate-600 border-t border-slate-900 bg-slate-950/60 z-10">
        Staff Kiosk Mode • Auto-logging attendance with strict tenant isolation
      </footer>

      {/* Admin Protected Exit Modal */}
      {isExitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-extrabold text-sm">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Admin Exit Authentication</span>
              </div>
              <button
                onClick={() => {
                  setIsExitModalOpen(false);
                  setExitError(null);
                  setAdminPinInput('');
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Enter your School Admin PIN or Password to unlock and return to the School Admin Dashboard.
            </p>

            <form onSubmit={handleVerifyAdminExit} className="space-y-3">
              <input
                type="password"
                autoFocus
                placeholder="Enter Admin PIN / Password"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-center font-mono text-sm tracking-widest text-white focus:outline-none focus:border-blue-500"
              />

              {exitError && (
                <p className="text-[11px] font-bold text-rose-400 text-center">{exitError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsExitModalOpen(false);
                    setExitError(null);
                    setAdminPinInput('');
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingExit || !adminPinInput.trim()}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {verifyingExit ? 'Verifying...' : 'Unlock & Exit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
