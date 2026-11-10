'use client';

import React from 'react';
import Link from 'next/link';
import { PublicNavbar } from '@/components/public-navbar';
import { PublicFooter } from '@/components/public-footer';
import { getPlanFeatureCopy } from '@/lib/plan-feature-copy';

interface PlanFeatureData {
  featureKey: string;
  enabledByDefault: boolean;
  feature: { name: string; description?: string | null };
}

interface PlanData {
  id: string;
  name: string;
  studentCeiling: number;
  price: number;
  pinRequired: boolean;
  platformFeePercent: number;
  features: PlanFeatureData[];
}

interface LandingClientProps {
  plans: PlanData[];
}

const capabilities = [
  { title: 'Attendance & records', text: 'Keep class registers, student records and staff information organised.' },
  { title: 'Fees & follow-up', text: 'Record school fees and see which balances need attention.' },
  { title: 'Term results', text: 'Move assessment work through review and report-card publishing.' },
  { title: 'Family access', text: 'Give parents a clear way to reach school updates and published results.' },
];

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[680px] pb-10 sm:pb-14" data-ui="sample-product-preview">
      <div className="relative z-10 w-[91%] overflow-hidden rounded-lg border border-white/25 bg-white text-[#263548] shadow-[0_32px_70px_-25px_rgba(0,0,0,.65)]">
        <div className="flex h-8 items-center gap-1.5 border-b border-[#e6eaf0] bg-[#f6f8fa] px-3" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-[#ef6c62]" /><span className="h-2 w-2 rounded-full bg-[#f1bd4f]" /><span className="h-2 w-2 rounded-full bg-[#62bd6c]" />
          <span className="ml-3 flex-1 rounded-sm bg-white px-2 py-1 text-[8px] text-[#8693a0]">school.yourdomain.com</span>
        </div>
        <div className="flex items-center justify-between border-b border-[#e8edf1] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#17834b] text-[10px] font-bold text-white">S</span><span className="text-[11px] font-bold text-[#263548] sm:text-xs">Your school website</span></div>
          <div className="hidden gap-4 text-[8px] font-medium text-[#71808e] sm:flex"><span>About</span><span>Academics</span><span>Admissions</span><span>Contact</span></div>
          <span className="rounded-sm bg-[#17834b] px-2.5 py-1.5 text-[8px] font-bold text-white">School portal</span>
        </div>
        <div className="grid min-h-[176px] grid-cols-[1.1fr_.9fr] bg-[#f0f4ed] sm:min-h-[215px]">
          <div className="flex flex-col justify-center px-4 py-5 sm:px-8">
            <p className="text-[8px] font-bold uppercase tracking-[.12em] text-[#17834b]">A connected school community</p>
            <p className="mt-2 max-w-[24ch] font-sans text-[19px] font-bold leading-tight tracking-[-.03em] text-[#102d43] sm:text-[27px]">A welcoming place to learn and grow.</p>
            <p className="mt-2 max-w-[37ch] text-[8px] leading-4 text-[#65737e] sm:text-[10px]">Share school information, news and the details families need.</p>
            <span className="mt-3 inline-flex w-fit items-center gap-2 bg-[#17834b] px-2.5 py-1.5 text-[8px] font-bold text-white">Explore the school <span aria-hidden="true">→</span></span>
          </div>
          <div className="relative m-3 overflow-hidden bg-[#c9d9b8] sm:m-4" aria-label="Illustrative school website image area">
            <div className="absolute bottom-0 left-0 right-0 h-[38%] bg-[#829767]" />
            <div className="absolute bottom-[31%] left-[14%] h-[45%] w-[72%] bg-[#f5f0df]" />
            <div className="absolute bottom-[31%] left-[10%] h-[50%] w-[80%] bg-[#e4dabf]" style={{ clipPath: 'polygon(50% 0, 100% 35%, 100% 100%, 0 100%, 0 35%)' }} />
            <div className="absolute bottom-[31%] left-[18%] h-[35%] w-[64%] bg-[#fbf8ee]" />
            <div className="absolute bottom-[31%] left-[43%] h-[21%] w-[17%] bg-[#7a9c6d]" />
            <span className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 text-[7px] font-semibold text-[#38533b] sm:text-[8px]">School cover image</span>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[#e8edf1] px-4 py-2.5 text-[8px] text-[#78848f] sm:px-5"><span>School information and parent access</span><span>Illustrative preview</span></div>
      </div>

      <div className="absolute bottom-0 right-0 z-20 w-[72%] overflow-hidden rounded-lg border border-[#d9e0e7] bg-white text-[#253448] shadow-[0_24px_55px_-22px_rgba(0,0,0,.65)]">
        <div className="flex h-7 items-center gap-1.5 border-b border-[#e7ebef] bg-[#f4f6f8] px-3" aria-hidden="true"><span className="h-2 w-2 rounded-full bg-[#ef6c62]" /><span className="h-2 w-2 rounded-full bg-[#f1bd4f]" /><span className="h-2 w-2 rounded-full bg-[#62bd6c]" /><span className="ml-3 flex-1 rounded-sm bg-white px-2 py-1 text-[7px] text-[#8693a0]">school workspace</span></div>
        <div className="flex min-h-[152px] sm:min-h-[180px]">
          <aside className="hidden w-[28%] flex-col gap-3 bg-[#102d43] px-3 py-4 text-[8px] text-white sm:flex"><strong className="mb-1 text-[9px]">BMS WORKSPACE</strong><span className="bg-[#17834b] px-2 py-1.5 font-semibold">Overview</span><span>Students</span><span>Attendance</span><span>Fees</span><span>Results</span></aside>
          <div className="min-w-0 flex-1 px-3 py-3 sm:px-4 sm:py-4">
            <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold sm:text-xs">School office</p><p className="mt-0.5 text-[7px] text-[#78848f] sm:text-[8px]">A quick view of work in progress</p></div><span className="bg-[#eaf4ec] px-2 py-1 text-[7px] font-semibold text-[#217344]">Current term</span></div>
            <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2"><div className="border border-[#e3e8ec] p-2"><p className="text-[7px] text-[#7c8995]">Attendance</p><p className="mt-1 text-[8px] font-bold text-[#2a3948]">Class registers</p></div><div className="border border-[#e3e8ec] p-2"><p className="text-[7px] text-[#7c8995]">Fees</p><p className="mt-1 text-[8px] font-bold text-[#2a3948]">Payment records</p></div><div className="border border-[#e3e8ec] p-2"><p className="text-[7px] text-[#7c8995]">Results</p><p className="mt-1 text-[8px] font-bold text-[#2a3948]">Term reports</p></div></div>
            <div className="mt-3 border border-[#e3e8ec]">
              <div className="grid grid-cols-[1.1fr_1fr_.7fr] bg-[#f6f8f9] px-2 py-1.5 text-[6px] font-bold uppercase tracking-wide text-[#7c8995] sm:text-[7px]"><span>School work</span><span>Next step</span><span>Status</span></div>
              <div className="grid grid-cols-[1.1fr_1fr_.7fr] border-t border-[#e8ecef] px-2 py-1.5 text-[7px] sm:text-[8px]"><span>Attendance</span><span>Review register</span><span className="font-semibold text-[#20804a]">Ready</span></div>
              <div className="grid grid-cols-[1.1fr_1fr_.7fr] border-t border-[#e8ecef] px-2 py-1.5 text-[7px] sm:text-[8px]"><span>Term results</span><span>Check reports</span><span className="font-semibold text-[#a46b1b]">In review</span></div>
            </div>
          </div>
        </div>
        <div className="border-t border-[#e7ebef] bg-[#fbfcfd] px-3 py-1.5 text-[7px] text-[#78848f] sm:px-4">Sample interface · No school records shown</div>
      </div>
    </div>
  );
}

function CheckMark() {
  return <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e5f3e8] text-[11px] font-bold text-[#137744]">✓</span>;
}

export function LandingClient({ plans }: LandingClientProps) {
  return (
    <div className="min-h-screen bg-white font-sans text-[#172d40] antialiased selection:bg-[#d6f0df] selection:text-[#102d43]">
      <PublicNavbar />

      <main>
        <section className="overflow-hidden bg-[linear-gradient(120deg,#092b45_0%,#0b344b_57%,#0a4b47_100%)] text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-24 pt-14 sm:px-8 sm:pb-28 sm:pt-20 lg:grid-cols-[.85fr_1.15fr] lg:gap-8 lg:px-10 lg:pt-16">
            <div className="relative z-10 max-w-[540px]">
              <p className="mb-5 text-xs font-bold uppercase tracking-[.14em] text-[#62d28c]">School management for the people who run schools</p>
              <h1 className="text-balance text-[43px] font-extrabold leading-[1.04] tracking-[-.045em] sm:text-[58px] lg:text-[64px]">
                A clear view of your school, <span className="text-[#38bf70]">every day.</span>
              </h1>
              <p className="mt-6 max-w-[470px] text-[15px] leading-7 text-[#d4e0e7] sm:text-base">
                Bring attendance, fee records, term results and parent access into one practical workspace for your school team.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#17834b] px-6 text-sm font-bold text-white transition-colors hover:bg-[#126b3d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#66d18d]">
                  Set up your school <span aria-hidden="true">→</span>
                </Link>
                <Link href="/services" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/45 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Explore BMS
                </Link>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#c4d3dc]">
                <span>For school owners</span><span>For teachers</span><span>For families</span>
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section className="relative z-10 mx-auto -mt-10 grid max-w-6xl grid-cols-2 overflow-hidden rounded-xl border border-[#e7ebef] bg-white shadow-[0_18px_45px_-30px_rgba(10,37,56,.45)] sm:grid-cols-4">
          {capabilities.map((item, index) => (
            <div key={item.title} className={`px-4 py-5 text-center sm:px-6 sm:py-6 ${index > 0 ? 'border-l border-[#edf0f2]' : ''} ${index > 1 ? 'border-t border-[#edf0f2] sm:border-t-0' : ''}`}>
              <p className="text-sm font-bold text-[#123149] sm:text-base">{item.title}</p>
              <p className="mt-1.5 text-[11px] leading-5 text-[#6b7a86] sm:text-xs">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 pt-24 sm:px-8 sm:pb-24 sm:pt-32 lg:px-10">
          <div className="grid gap-6 border-b border-[#e5e9ed] pb-10 md:grid-cols-[.9fr_1.1fr] md:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#18824b]">The school day, in one place</p><h2 className="mt-3 max-w-[14ch] text-3xl font-bold leading-tight tracking-[-.035em] text-[#102d43] sm:text-4xl">Give every task a clear next step.</h2></div>
            <p className="max-w-xl text-sm leading-7 text-[#5d6d78] md:justify-self-end sm:text-base">The school office, teachers and families all need different information. BMS brings the work together while giving each person the access they need.</p>
          </div>
          <div className="mt-8 grid gap-0 md:grid-cols-2">
            {capabilities.map((item, index) => (
              <article key={item.title} className={`flex gap-4 py-6 ${index % 2 === 1 ? 'md:pl-8' : 'md:pr-8'} ${index > 1 ? 'border-t border-[#e5e9ed]' : ''}`}>
                <CheckMark />
                <div><h3 className="text-base font-bold text-[#18334a]">{item.title}</h3><p className="mt-2 max-w-lg text-sm leading-6 text-[#657580]">{item.text}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-[#f3f6f2]">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[.85fr_1.15fr] lg:gap-16 lg:px-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.13em] text-[#18824b]">A better view for the school office</p>
              <h2 className="mt-3 max-w-[13ch] text-3xl font-bold leading-tight tracking-[-.035em] text-[#102d43] sm:text-4xl">Know what needs attention.</h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[#5d6d78] sm:text-base">Keep records, fee follow-up and term results in the same workspace. Staff can see the next task and continue the work without rebuilding the details in separate files.</p>
              <ul className="mt-6 space-y-3 text-sm text-[#304452]">
                <li className="flex gap-3"><CheckMark /> Student and staff records</li>
                <li className="flex gap-3"><CheckMark /> Attendance and fee workflows</li>
                <li className="flex gap-3"><CheckMark /> Results review and report cards</li>
              </ul>
              <Link href="/services" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#167444] hover:text-[#105f37]">See how the platform works <span aria-hidden="true">→</span></Link>
            </div>
            <div className="overflow-hidden rounded-lg border border-[#d9e1e6] bg-white shadow-[0_25px_55px_-35px_rgba(10,37,56,.5)]" data-ui="sample-workspace">
              <div className="flex items-center justify-between border-b border-[#e7ebef] px-4 py-3 sm:px-6"><div><p className="text-sm font-bold text-[#20384a]">School workspace</p><p className="mt-0.5 text-[11px] text-[#788691]">Illustrative sample view</p></div><span className="bg-[#eaf4ec] px-2.5 py-1.5 text-[10px] font-bold text-[#217344]">Current term</span></div>
              <div className="grid grid-cols-3 gap-3 bg-[#f7f9fa] p-4 sm:p-6">
                <div className="border border-[#e5eaee] bg-white p-3 sm:p-4"><p className="text-[10px] text-[#75838d]">Attendance</p><p className="mt-2 text-sm font-bold text-[#20384a] sm:text-base">Class registers</p><p className="mt-1 text-[9px] text-[#788691] sm:text-[10px]">Daily records</p></div>
                <div className="border border-[#e5eaee] bg-white p-3 sm:p-4"><p className="text-[10px] text-[#75838d]">Fees</p><p className="mt-2 text-sm font-bold text-[#20384a] sm:text-base">Payment records</p><p className="mt-1 text-[9px] text-[#788691] sm:text-[10px]">Follow-up list</p></div>
                <div className="border border-[#e5eaee] bg-white p-3 sm:p-4"><p className="text-[10px] text-[#75838d]">Results</p><p className="mt-2 text-sm font-bold text-[#20384a] sm:text-base">Term reports</p><p className="mt-1 text-[9px] text-[#788691] sm:text-[10px]">Review and publish</p></div>
              </div>
              <div className="px-4 pb-4 sm:px-6 sm:pb-6"><div className="flex items-center justify-between pb-3"><p className="text-xs font-bold text-[#344a59]">Recent school work</p><span className="text-[10px] text-[#788691]">Sample interface</span></div>
                <div className="grid grid-cols-[1.1fr_1fr_.8fr] bg-[#f6f8f9] px-3 py-2 text-[9px] font-bold uppercase tracking-wide text-[#778590]"><span>Record</span><span>Next step</span><span>Status</span></div>
                <div className="grid grid-cols-[1.1fr_1fr_.8fr] border-b border-[#e8ecef] px-3 py-3 text-[10px] text-[#344a59] sm:text-xs"><span>Class attendance</span><span>Review register</span><span className="font-semibold text-[#20804a]">Ready</span></div>
                <div className="grid grid-cols-[1.1fr_1fr_.8fr] border-b border-[#e8ecef] px-3 py-3 text-[10px] text-[#344a59] sm:text-xs"><span>Term results</span><span>Check reports</span><span className="font-semibold text-[#a46b1b]">In review</span></div>
              </div>
              <div className="border-t border-[#e7ebef] bg-[#fbfcfd] px-4 py-2.5 text-[10px] text-[#788691] sm:px-6">Illustrative sample only · No school or student records shown</div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
          <div className="grid gap-8 md:grid-cols-[.85fr_1.15fr] md:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#18824b]">People around the school</p><h2 className="mt-3 max-w-[12ch] text-3xl font-bold leading-tight tracking-[-.035em] text-[#102d43] sm:text-4xl">A useful view for each role.</h2></div>
            <p className="max-w-xl text-sm leading-7 text-[#5d6d78] md:justify-self-end sm:text-base">Owners need oversight. Teachers need simple academic workflows. Families need access to the information their school shares.</p>
          </div>
          <div className="mt-10 divide-y divide-[#e5e9ed] border-y border-[#e5e9ed]">
            <article className="grid gap-3 py-5 sm:grid-cols-[190px_1fr] sm:gap-8"><h3 className="text-sm font-bold text-[#18334a]">School owners</h3><p className="max-w-3xl text-sm leading-6 text-[#657580]">Oversee school records, plan access, fee activity and the work moving through each term.</p></article>
            <article className="grid gap-3 py-5 sm:grid-cols-[190px_1fr] sm:gap-8"><h3 className="text-sm font-bold text-[#18334a]">Teachers</h3><p className="max-w-3xl text-sm leading-6 text-[#657580]">Record attendance and assessment work, then send results through the school’s review process.</p></article>
            <article className="grid gap-3 py-5 sm:grid-cols-[190px_1fr] sm:gap-8"><h3 className="text-sm font-bold text-[#18334a]">Families</h3><p className="max-w-3xl text-sm leading-6 text-[#657580]">Use the school portal to check published information, results and updates shared with them.</p></article>
          </div>
        </section>

        <section className="bg-[#0b2f48] text-white" id="plans">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
              <div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#63d28b]">Plans for different school sizes</p><h2 className="mt-3 max-w-[13ch] text-3xl font-bold leading-tight tracking-[-.035em] sm:text-4xl">Choose what fits your school.</h2></div>
              <Link href="/pricing" className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/40 px-5 text-sm font-semibold text-white hover:bg-white/10">Compare all plan details <span aria-hidden="true">→</span></Link>
            </div>
            {plans.length > 0 ? (
              <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {plans.slice(0, 3).map((plan) => {
                  const enabledFeatures = plan.features.filter((feature) => feature.enabledByDefault);
                  const previewFeatures = enabledFeatures.slice(0, 3);
                  const remainingFeatures = Math.max(0, enabledFeatures.length - previewFeatures.length);
                  const hasCustomDomain = enabledFeatures.some((feature) => feature.featureKey === 'custom_domain');
                  return (
                    <article key={plan.id} className="flex flex-col border border-white/20 bg-white p-5 text-[#18334a] sm:p-6">
                      <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{plan.name}</h3><p className="mt-1 text-xs text-[#71808a]">Up to {plan.studentCeiling.toLocaleString()} students</p></div>{hasCustomDomain && <span className="bg-[#e7f4ea] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#177343]">Custom domain</span>}</div>
                      <p className="mt-5 text-2xl font-extrabold tracking-tight">₦{Number(plan.price).toLocaleString()}<span className="ml-1 text-[11px] font-medium text-[#71808a]">per academic term</span></p>
                      <p className="mt-2 text-[11px] leading-5 text-[#687984]">{Number(plan.platformFeePercent)}% fee on result PIN sales. {plan.pinRequired ? 'A PIN is required to view results.' : 'A PIN is not required to view results.'}</p>
                      <div className="mt-5 border-t border-[#e5e9ed] pt-4"><p className="text-xs font-bold">Included tools</p><ul className="mt-3 space-y-3">{previewFeatures.map((feature) => { const copy = getPlanFeatureCopy(feature.featureKey, feature.feature.name, feature.feature.description); return <li key={feature.featureKey}><p className="text-xs font-semibold">{copy.name}</p><p className="mt-0.5 text-[10px] leading-4 text-[#71808a]">{copy.description}</p></li>; })}</ul>{remainingFeatures > 0 && <p className="mt-3 text-[10px] text-[#71808a]">Plus {remainingFeatures} more included {remainingFeatures === 1 ? 'tool' : 'tools'}.</p>}</div>
                      <Link href={`/register?planId=${encodeURIComponent(plan.id)}`} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 bg-[#17834b] px-4 text-xs font-bold text-white transition-colors hover:bg-[#126b3d]">Choose {plan.name} <span aria-hidden="true">→</span></Link>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-8 max-w-2xl border-l-4 border-[#36b76c] bg-white/10 px-5 py-4 text-sm leading-6 text-[#e0e9ed]">Plan details are being prepared. Contact us and we’ll help you find the right fit.</p>
            )}
            <p className="mt-5 text-xs text-[#c3d3dc]">Custom school domains are available only on Enterprise.</p>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-[1fr_auto] md:items-center lg:px-10">
          <div><h2 className="max-w-[16ch] text-3xl font-bold leading-tight tracking-[-.035em] text-[#102d43] sm:text-4xl">Make the school day easier to keep on track.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#5d6d78]">Set up the workspace around your school, then bring your team into one shared system.</p></div>
          <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-3 bg-[#17834b] px-6 text-sm font-bold text-white transition-colors hover:bg-[#126b3d]">Set up your school <span aria-hidden="true">→</span></Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
