import React from 'react';
import Link from 'next/link';

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-[#092b45] py-12 text-[#d1dce3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 border-b border-white/15 pb-10 md:grid-cols-4">
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#17834b] text-sm font-bold text-white">
                B
              </div>
              <span className="text-base font-bold tracking-tight text-white">BMS</span>
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-[#b7c7d1]">
              School management for the people who keep each school day moving.
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-bold text-white">Platform</h4>
            <ul className="space-y-2.5 text-xs text-[#d1dce3]">
              <li><Link href="/" className="transition-colors hover:text-[#68d28f]">Home</Link></li>
              <li><Link href="/services" className="transition-colors hover:text-[#68d28f]">What BMS does</Link></li>
              <li><Link href="/pricing" className="transition-colors hover:text-[#68d28f]">Plans</Link></li>
              <li><Link href="/register" className="transition-colors hover:text-[#68d28f]">Set up your school</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-bold text-white">About BMS</h4>
            <ul className="space-y-2.5 text-xs text-[#d1dce3]">
              <li><Link href="/about" className="transition-colors hover:text-[#68d28f]">About us</Link></li>
              <li><Link href="/schools" className="transition-colors hover:text-[#68d28f]">School directory</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-bold text-white">Access</h4>
            <ul className="space-y-2.5 text-xs text-[#d1dce3]">
              <li><Link href="/schools" className="transition-colors hover:text-[#68d28f]">Find your school</Link></li>
              <li><Link href="/admin/login" className="transition-colors hover:text-[#68d28f]">School sign in</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-center pt-8 text-xs text-[#a9bac5]">
          <div>
            © {new Date().getFullYear()} BMS. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
