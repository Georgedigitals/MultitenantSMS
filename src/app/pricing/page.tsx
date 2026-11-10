import React from 'react';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { PublicNavbar } from '@/components/public-navbar';
import { PublicFooter } from '@/components/public-footer';
import { getPlanFeatureCopy } from '@/lib/plan-feature-copy';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pricing Matrix | BMS EduSaaS Platform',
  description: 'Transparent subscription tier pricing for BMS EduSaaS Platform. Starter, Standard, and Enterprise tiers with student ceiling caps and PIN monetization.',
};

export default async function PricingPage() {
  let plans: any[] = [];
  try {
    plans = await prisma.plan.findMany({
      include: {
        features: {
          include: {
            feature: true,
          },
        },
      },
      orderBy: { price: 'asc' },
    });

    plans = (plans || []).map((p: any) => ({
      ...p,
      price: Number(p.price),
      platformFeePercent: Number(p.platformFeePercent),
      features: (p.features || []).filter((f: any) => f.enabledByDefault).map((f: any) => ({
        ...f,
        feature: f.feature || { name: f.featureKey.replace(/_/g, ' '), description: null },
      })),
    }));
  } catch (err: any) {
    console.warn('[PricingPage] DB fallback applied:', err?.message || err);
  }

  const faqs = [
    {
      q: 'How does the student ceiling work?',
      a: 'It is the maximum number of active students included in the plan. Choose a plan with enough room for your current enrolment.',
    },
    {
      q: 'When does the platform fee apply?',
      a: 'Only when your school sells a result access PIN. The percentage shown for your plan is taken from each PIN sale; it does not apply to school fee payments.',
    },
    {
      q: 'Which plan includes a custom domain?',
      a: 'The Enterprise plan includes the option to use your school’s own web address. You will need access to that domain’s DNS settings to connect it.',
    },
    {
      q: 'How does billing work?',
      a: 'The listed subscription price is for one full academic year (annual session). Your school can change plans as its needs change.',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#172d40] antialiased">
      <PublicNavbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
        <header className="mb-12 grid gap-5 bg-[linear-gradient(120deg,#092b45_0%,#0b344b_57%,#0a4b47_100%)] px-6 py-9 text-white sm:px-9 sm:py-12 md:grid-cols-[1fr_0.7fr] md:items-end">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[.13em] text-[#63d28b]">Plans built around your school</p>
            <h1 className="max-w-[13ch] text-4xl font-extrabold leading-[1.08] tracking-[-.04em] sm:text-5xl">Choose a plan for your school</h1>
          </div>
          <p className="max-w-lg text-sm leading-6 text-[#d4e0e7] md:justify-self-end">
            Compare the student limit, the tools included and the fee on result PIN sales. All prices shown are for one academic year.
          </p>
        </header>

        {plans.length === 0 ? (
          <p className="bg-[#f3f6f2] p-6 text-sm leading-6 text-[#536775]">Plan pricing is being updated. Contact us and we’ll help you choose the right fit.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((p: any) => {
              const enabledFeatures = (p.features || []).filter((feature: any) => feature.enabledByDefault !== false);
              const hasCustomDomain = enabledFeatures.some((feature: any) => feature.featureKey === 'custom_domain');
              const surface = hasCustomDomain ? 'bg-[#f3f7f1]' : 'bg-white';
              const description = hasCustomDomain
                ? `For schools with up to ${Number(p.studentCeiling).toLocaleString()} students that need their own web address.`
                : `For schools with up to ${Number(p.studentCeiling).toLocaleString()} students, with the included tools listed below.`;

              return (
                <article key={p.id} className={`flex min-h-full flex-col border border-[#dce3e8] p-6 sm:p-7 ${surface}`}>
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold tracking-tight text-[#26362b]">{p.name}</h2>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-[#697269]">{description}</p>

                    <div className="mt-7">
                      <p className="text-3xl font-semibold tracking-tight text-[#26362b]">₦{Number(p.price).toLocaleString()}</p>
                      <p className="mt-1 text-sm text-[#697269]">per academic year</p>
                    </div>

                    <div className="mt-6 space-y-3 border-y border-[#d9dfd5] py-4 text-sm">
                      <p className="flex flex-wrap justify-between gap-2"><span className="text-[#697269]">Active students</span><strong className="font-semibold text-[#26362b]">Up to {Number(p.studentCeiling).toLocaleString()}</strong></p>
                      <p className="flex flex-wrap justify-between gap-2"><span className="text-[#697269]">Fee on each result PIN sale</span><strong className="font-semibold text-[#26362b]">{Number(p.platformFeePercent)}%</strong></p>
                      <p className="flex flex-wrap justify-between gap-2"><span className="text-[#697269]">Results access</span><strong className="font-semibold text-[#26362b]">{p.pinRequired ? 'PIN required' : 'No PIN required'}</strong></p>
                    </div>

                    <div className="pt-6">
                      <h3 className="text-sm font-semibold text-[#344137]">What your school gets</h3>
                      {enabledFeatures.length > 0 ? (
                        <ul className="mt-4 space-y-4">
                          {enabledFeatures.map((feature: any) => {
                            const copy = getPlanFeatureCopy(feature.featureKey, feature.feature.name, feature.feature.description);
                            return (
                              <li key={feature.featureKey} className="border-l-2 border-[#819472] pl-3">
                                <p className="text-sm font-semibold text-[#344137]">{copy.name}</p>
                                <p className="mt-1 text-xs leading-5 text-[#697269]">{copy.description}</p>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm leading-6 text-[#697269]">Plan inclusions are being updated. Contact us for the current list.</p>
                      )}
                      {hasCustomDomain && <p className="mt-5 text-xs leading-5 text-[#59664f]">Your school’s own web address is included. You’ll need access to its DNS settings to connect it.</p>}
                    </div>
                  </div>

                  <Link href={`/register?planId=${p.id}`} className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 bg-[#315540] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#274633] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315540]">
                    Choose {p.name} <span aria-hidden="true">→</span>
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        <section className="mt-20 grid gap-8 border-t border-[#e5e7de] pt-10 md:grid-cols-[.65fr_1.35fr]">
          <div>
            <h2 className="font-serif text-3xl leading-tight tracking-[-.03em] text-[#243128]">Questions about the plans?</h2>
            <p className="mt-3 text-sm leading-6 text-[#697269]">A few details that can help you decide.</p>
          </div>
          <div className="divide-y divide-[#e2e5dc]">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-4 first:pt-0 last:pb-0">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[#344137] marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#315540]">
                  {faq.q}<span className="text-lg font-normal text-[#64755e] transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="max-w-2xl pb-2 pr-8 text-sm leading-6 text-[#697269]">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
