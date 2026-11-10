import Link from 'next/link';
import { PublicNavbar } from '@/components/public-navbar';
import { PublicFooter } from '@/components/public-footer';

export const metadata = {
  title: 'About BMS | School Management',
  description: 'Learn why BMS brings school operations, academic records and family access into one workspace.',
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-[#172d40]">
      <PublicNavbar />
      <main className="flex-1">
        <section className="bg-[linear-gradient(120deg,#092b45_0%,#0b344b_57%,#0a4b47_100%)] text-white">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
            <p className="text-xs font-bold uppercase tracking-[.13em] text-[#63d28b]">About BMS</p>
            <h1 className="mt-4 max-w-[15ch] text-4xl font-extrabold leading-[1.06] tracking-[-.04em] sm:text-5xl">School work is easier when the details connect.</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#d4e0e7] sm:text-base">BMS brings the everyday work of running a school into one place—from student records and attendance to fee follow-up, term results and family access.</p>
            <div className="mt-7 flex flex-wrap gap-3"><Link href="/register" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#17834b] px-5 text-sm font-bold text-white hover:bg-[#126b3d]">Set up your school <span aria-hidden="true">→</span></Link><Link href="/services" className="inline-flex min-h-11 items-center justify-center border border-white/40 px-5 text-sm font-semibold text-white hover:bg-white/10">Explore the platform</Link></div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-[.85fr_1.15fr] lg:px-10">
          <h2 className="max-w-[13ch] text-3xl font-bold leading-tight tracking-[-.035em] text-[#102d43] sm:text-4xl">Made for the people who keep a school moving.</h2>
          <div className="max-w-2xl space-y-5 text-sm leading-7 text-[#5d6d78] sm:text-base">
            <p>School owners, teachers and families need different views of the same school day. BMS gives them a shared system for records, academic work and the information the school chooses to publish.</p>
            <p>Each school can set up its workspace and public portal around its needs. Plans define student capacity and the additional tools available, including custom domains on Enterprise.</p>
          </div>
        </section>

        <section className="bg-[#f3f6f2]">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
            <div className="grid gap-5 border-b border-[#dce4dc] pb-8 md:grid-cols-[.9fr_1.1fr] md:items-end">
              <h2 className="max-w-[13ch] text-3xl font-bold leading-tight tracking-[-.035em] text-[#102d43]">One school. Different responsibilities.</h2>
              <p className="max-w-xl text-sm leading-6 text-[#5d6d78] md:justify-self-end">The right information should be available to the people doing the work, without asking every team to manage a separate set of records.</p>
            </div>
            <div className="mt-2 divide-y divide-[#dce4dc]">
              <article className="grid gap-3 py-5 sm:grid-cols-[190px_1fr] sm:gap-8"><h3 className="text-sm font-bold text-[#18334a]">School owners</h3><p className="max-w-3xl text-sm leading-6 text-[#5d6d78]">Review school activity, manage plan access and keep an overview of the work moving through each term.</p></article>
              <article className="grid gap-3 py-5 sm:grid-cols-[190px_1fr] sm:gap-8"><h3 className="text-sm font-bold text-[#18334a]">Teachers</h3><p className="max-w-3xl text-sm leading-6 text-[#5d6d78]">Handle attendance and academic records through the school’s review and reporting workflows.</p></article>
              <article className="grid gap-3 py-5 sm:grid-cols-[190px_1fr] sm:gap-8"><h3 className="text-sm font-bold text-[#18334a]">Families</h3><p className="max-w-3xl text-sm leading-6 text-[#5d6d78]">Use the school portal to reach the results and updates made available by the school.</p></article>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-[1fr_auto] md:items-center lg:px-10">
          <div><h2 className="max-w-[15ch] text-3xl font-bold leading-tight tracking-[-.035em] text-[#102d43] sm:text-4xl">See how BMS fits your school.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#5d6d78]">Explore the platform or compare plans before you create a workspace.</p></div>
          <div className="flex flex-wrap gap-3"><Link href="/services" className="inline-flex min-h-11 items-center justify-center border border-[#b8c5cc] px-5 text-sm font-semibold text-[#18334a] hover:bg-[#f3f6f2]">Explore features</Link><Link href="/pricing" className="inline-flex min-h-11 items-center justify-center bg-[#17834b] px-5 text-sm font-bold text-white hover:bg-[#126b3d]">Compare plans</Link></div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
