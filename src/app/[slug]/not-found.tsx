import React from 'react';
import Link from 'next/link';

export default function TenantNotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center font-sans antialiased">
      <div className="max-w-md w-full space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 text-white mx-auto flex items-center justify-center text-2xl font-black shadow-md">
          404
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            The requested page or resource does not exist or has been moved.
          </p>
        </div>

        <div className="pt-4 flex justify-center">
          <Link
            href="./"
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all"
          >
            ← Return to School Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
