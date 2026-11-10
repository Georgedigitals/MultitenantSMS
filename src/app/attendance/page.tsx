import { redirect } from 'next/navigation';

export default async function AttendanceRootPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  if (slug) {
    redirect(`/${slug}/attendance/staff`);
  }
  redirect('/attendance/staff');
}

