import Link from 'next/link';
import { PublicNavbar } from '@/components/public-navbar';
import { PublicFooter } from '@/components/public-footer';

export const metadata = {
  title: 'Platform | BMS School Management',
  description: 'Explore how BMS supports school records, attendance, fees, results and family access.',
};

const capabilities = [
  {
    title: 'Student and staff records',
    description: 'Keep the core school directory, class information and staff records in one workspace.',
    points: ['Student profiles and class lists', 'Staff records and role-based access', 'Academic sessions and terms'],
  },
  {
    title: 'Attendance and school routines',
    description: 'Record attendance and give staff a consistent place to follow daily school activity.',
    points: ['Class attendance registers', 'Staff attendance', 'A clear record for follow-up'],
  },
  {
    title: 'Fees and payment records',
    description: 'Set up fee items, record payments and review balances that still need attention.',
    points: ['Fee items and student ledgers', 'Payment records and receipts', 'Balance review'],
  },
  {
    title: 'Assessments and report cards',
    description: 'Move academic work from assessment entry through review and report-card publishing.',
    points: ['Assessment components and grading', 'Teacher entry and school review', 'Published reports for families'],
  },
  {
    title: 'Parent and student access',
    description: 'Provide a school portal for families to access the information the school shares.',
    points: ['School announcements and updates', 'Published results and report cards', 'Fee information where enabled'],
  },
  {
    title: 'School website and domain',
    description: 'Give each school a public website connected to its own workspace. A custom domain is available on Enterprise.',
    points: ['School information and galleries', 'A school-specific portal address', 'Custom domain option on Enterprise'],
  },
];

export default function ServicesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-[#172d40]">
      <PublicNavbar />
      <main className="flex-1">
        <section className="bg-[linear-gradient(120deg,#092b45_0%,#0b344b_57%,#0a4b47_100%)] text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-[1fr_.8fr] md:items-end lg:px-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.13em] text-[#63d28b]">A practical school workspace</p>
              <h1 className="mt-4 max-w-[14ch] text-4xl font-extrabold leading-[1.06] tracking-[-.04em] sm:text-5xl">The tools that keep school work moving.</h1>
            </div>
            <div>
              <p className="max-w-xl text-sm leading-7 text-[#d4e0e7] sm:text-base">BMS connects school records, attendance, fees, academic results and family access. Each school uses its own workspace and enables the tools included in its plan.</p>
              <div className="mt-6 flex flex-wrap gap-3"><Link href="/register" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#17834b] px-5 text-sm font-bold text-white hover:bg-[#126b3d]">Set up your school <span aria-hidden="true">→</span></Link><Link href="/pricing" className="inline-flex min-h-11 items-center justify-center border border-white/40 px-5 text-sm font-semibold text-white hover:bg-white/10">Compare plans</Link></div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="mb-9 grid gap-5 border-b border-[#e5e9ed] pb-8 md:grid-cols-[.9fr_1.1fr] md:items-end">
            <h2 className="max-w-[14ch] text-3xl font-bold leading-tight tracking-[-.035em] text-[#102d43] sm:text-4xl">One workspace for the school day.</h2>
            <p className="max-w-xl text-sm leading-7 text-[#5d6d78] md:justify-self-end sm:text-base">The platform brings routine administration and academic work into a shared system, with tools for owners, teachers and families.</p>
          </div>
          <div className="divide-y divide-[#e5e9ed] border-y border-[#e5e9ed]">
            {capabilities.map((capability, index) => (
              <article key={capability.title} className="grid gap-5 py-7 md:grid-cols-[.8fr_1.2fr] md:gap-8">
                <div><h3 className="text-lg font-bold text-[#18334a]">{capability.title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[#657580]">{capability.description}</p></div>
                <ul className="grid gap-2 text-sm text-[#435764] sm:grid-cols-2 md:pl-8">
                  {capability.points.map((point) => <li key={point} className="flex gap-2"><span className="font-bold text-[#17834b]" aria-hidden="true">✓</span>{point}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-[#f3f6f2]">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-[1fr_auto] md:items-center lg:px-10">
            <div><h2 className="max-w-[16ch] text-3xl font-bold leading-tight tracking-[-.035em] text-[#102d43]">See what your school plan includes.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#5d6d78]">Compare student limits, included tools and the fee on result PIN sales before choosing a plan.</p></div>
            <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#17834b] px-6 text-sm font-bold text-white hover:bg-[#126b3d]">View plan details <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
