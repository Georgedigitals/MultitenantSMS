import prisma from './prisma';
import { getTenantBrandingTokens, computeBrandingTokensFromTenant } from './branding';
import { findTenantBySlugOrDomain } from './tenant';

export interface HeroSlide {
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  ctaText?: string;
  ctaLink?: string;
}

export interface PublicSiteData {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  branding: Awaited<ReturnType<typeof getTenantBrandingTokens>>;
  templateId: 'heritage' | 'vanguard' | 'horizon';
  hero: {
    title: string;
    subtitle: string;
    imageUrl: string | null;
    motto?: string;
    sliderSlides: HeroSlide[];
    featuredStudent: { name: string; className: string; achievement: string; imageUrl: string | null } | null;
  };
  about: {
    title: string;
    text: string;
    mission: string;
    vision: string;
    coreValues: string[];
    principalMessage: string;
    headName?: string;
    headPhotoUrl?: string | null;
    campusPhotoUrl?: string | null;
    anthem?: string;
  };
  stats: {
    foundedYear: string;
    teacherRatio: string;
    passRate: string;
  };
  newsEvents: Array<{
    date: string;
    category: 'Event' | 'News';
    title: string;
    summary?: string;
    imageUrl?: string | null;
  }>;
  parentQuote: {
    quote: string;
    author: string;
    role: string;
  };
  highlights: {
    headline: string;
    featureImageUrl?: string | null;
    items: Array<{ title: string; body: string }>;
  };
  academics: {
    text: string;
    highlights: string[];
    curricula: string[];
    levels: Array<{ name: string; description: string; ages: string; imageUrl?: string | null }>;
  };
  admissions: {
    text: string;
    requirements: string[];
    process: Array<{ step: number; title: string; desc: string }>;
    feeGuideText: string;
  };
  contact: {
    email: string | null;
    phone: string | null;
    whatsapp?: string | null;
    address: string | null;
    officeHours?: string;
  };
  gallery: Array<{
    id: string;
    imageUrl: string;
    caption: string | null;
    album: string | null;
    uploadedAt: Date;
  }>;
}

/**
 * Resolves full public site data for a tenant (§7A).
 */
export async function getPublicSiteContent(tenantSlugOrId: string): Promise<PublicSiteData> {
  const tenant = await findTenantBySlugOrDomain(tenantSlugOrId);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const branding = computeBrandingTokensFromTenant(tenant);

  const [siteContents, gallery] = await Promise.all([
    prisma.siteContent.findMany({
      where: { tenantId: tenant.id },
    }),
    prisma.galleryImage.findMany({
      where: { tenantId: tenant.id },
      orderBy: { uploadedAt: 'desc' },
    }),
  ]);

  const homeContent = siteContents.find((sc: any) => sc.page === 'home')?.content as any || {};
  const aboutContent = siteContents.find((sc: any) => sc.page === 'about')?.content as any || {};
  const academicsContent = siteContents.find((sc: any) => sc.page === 'academics')?.content as any || {};
  const contactContent = siteContents.find((sc: any) => sc.page === 'contact')?.content as any || {};

  const admissionsContent = siteContents.find((sc: any) => sc.page === 'admissions')?.content as any || {};

  const galleryImagesList = gallery.map((img: any) => ({
    id: img.id,
    imageUrl: img.imageUrl,
    caption: img.caption,
    album: img.album,
    uploadedAt: img.uploadedAt,
  }));

  const templateId = (homeContent.templateId || branding.templateId || 'heritage') as 'heritage' | 'vanguard' | 'horizon';
  const heroImg = homeContent.heroImageUrl || (galleryImagesList[0]?.imageUrl) || null;

  const defaultSlides: HeroSlide[] = [
    {
      title: homeContent.heroTitle || `Welcome to ${tenant.name}`,
      subtitle: homeContent.heroSubtitle || 'Nurturing academic brilliance, leadership character, and transformative innovation.',
      imageUrl: heroImg,
      ctaText: 'Apply for Admission',
      ctaLink: '/admissions',
    },
    {
      title: 'Academic Distinction & Moral Integrity',
      subtitle: 'An enriching curriculum curated to inspire intellectual curiosity and lifelong achievement.',
      imageUrl: galleryImagesList[1]?.imageUrl || heroImg,
      ctaText: 'Discover Academics',
      ctaLink: '/academics',
    },
    {
      title: 'State-of-the-Art Facilities & STEM',
      subtitle: 'Modern digital laboratories, athletics complexes, and creative arts studios for holistic student growth.',
      imageUrl: galleryImagesList[2]?.imageUrl || heroImg,
      ctaText: 'Tour Campus Life',
      ctaLink: '/gallery',
    },
  ];

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    },
    branding,
    templateId,
    hero: {
      title: homeContent.heroTitle || `Welcome to ${tenant.name}`,
      subtitle: homeContent.heroSubtitle || 'Empowering Students for Excellence and Leadership',
      imageUrl: heroImg,
      motto: homeContent.motto || 'Academic Excellence & Moral Leadership',
      sliderSlides: Array.isArray(homeContent.sliderSlides) && homeContent.sliderSlides.length > 0
        ? homeContent.sliderSlides
        : defaultSlides,
      featuredStudent: homeContent.featuredStudent?.name
        ? {
            name: String(homeContent.featuredStudent.name).slice(0, 100),
            className: String(homeContent.featuredStudent.className || '').slice(0, 80),
            achievement: String(homeContent.featuredStudent.achievement || '').slice(0, 300),
            imageUrl: typeof homeContent.featuredStudent.imageUrl === 'string' ? homeContent.featuredStudent.imageUrl : null,
          }
        : null,
    },
    about: {
      title: aboutContent.title || `About ${tenant.name}`,
      text: aboutContent.text || `${tenant.name} is dedicated to providing high-quality education, character development, and academic excellence in a supportive environment.`,
      mission: aboutContent.mission || `To inspire intellectual growth, moral fortitude, and global leadership skills in every learner through purposeful inquiry and high standards.`,
      vision: aboutContent.vision || `To be a premier institution recognized regionally and globally for transformative education, ethical grounding, and academic innovation.`,
      coreValues: aboutContent.coreValues || ['Excellence', 'Integrity', 'Innovation', 'Discipline', 'Empathy & Service'],
      principalMessage: aboutContent.principalMessage || `At ${tenant.name}, we believe every child possesses innate gifts waiting to be unlocked. Our dedicated faculty fosters an environment of curiosity, resilience, and compassion.`,
      headName: aboutContent.headName || `Head of School, ${tenant.name}`,
      headPhotoUrl: aboutContent.headPhotoUrl || null,
      campusPhotoUrl: aboutContent.campusPhotoUrl || null,
      anthem: aboutContent.anthem || `Forward ever, backward never, shining brightly as the stars. In truth and knowledge we strive, building future leaders for tomorrow.`,
    },
    stats: {
      foundedYear: String(homeContent.foundedYear || new Date(tenant.createdAt).getFullYear()),
      teacherRatio: String(homeContent.teacherRatio || '12:1'),
      passRate: String(homeContent.passRate || '98%'),
    },
    newsEvents:
      Array.isArray(homeContent.newsEvents) && homeContent.newsEvents.length > 0
        ? homeContent.newsEvents
        : [
            {
              date: 'Open Day',
              category: 'Event',
              title: 'Campus Open Day & Tour',
              summary: 'Meet our faculty, tour our classrooms, and experience an ordinary school day.',
              imageUrl: galleryImagesList[1]?.imageUrl || null,
            },
            {
              date: '20 Jun',
              category: 'Event',
              title: 'Annual Sports & Athletics Day',
              summary: 'Inter-house track, field, and team events celebrating spirit and teamwork.',
              imageUrl: galleryImagesList[2]?.imageUrl || null,
            },
            {
              date: 'New',
              category: 'News',
              title: 'Admissions Open for Upcoming Session',
              summary: 'Applications are now open across Early Years, Primary, and Secondary stages.',
              imageUrl: galleryImagesList[3]?.imageUrl || null,
            },
          ],
    parentQuote: {
      quote:
        homeContent.parentQuote?.quote ||
        `Our child looks forward to school every single morning. The teachers know every student personally and keep parents informed at every step.`,
      author: homeContent.parentQuote?.author || 'Parent Community',
      role: homeContent.parentQuote?.role || `${tenant.name} Family`,
    },
    highlights: {
      headline: homeContent.highlights?.headline || 'Small classes, big attention.',
      featureImageUrl: homeContent.highlights?.featureImageUrl || null,
      items:
        Array.isArray(homeContent.highlights?.items) && homeContent.highlights.items.length > 0
          ? homeContent.highlights.items
          : [
              {
                title: 'An open door',
                body: 'Direct, regular communication between teachers and parents every week.',
              },
              {
                title: 'Outdoors, every day',
                body: 'Balanced academics, creative arts, sports, and practical discovery across every term.',
              },
              {
                title: 'Small classes',
                body: 'Teachers who notice the quiet child as much as the loud one.',
              },
              {
                title: 'Stories first',
                body: 'Language, curiosity, and structured reading built every single day.',
              },
            ],
    },
    academics: {
      text: academicsContent.text || 'We offer a comprehensive curriculum designed to nurture critical thinking, creativity, and STEM capabilities.',
      highlights: academicsContent.highlights || ['Early Years Foundation', 'Primary Education & Core Literacy', 'Middle / Junior Secondary', 'Senior Secondary & Exam Preparation'],
      curricula: academicsContent.curricula || ['National & International Curriculum Standards', 'STEM, Robotics & Digital Literacy', 'Creative Arts, Sports & Leadership'],
      levels: academicsContent.levels || [
        { name: 'Early Years & Nursery', ages: 'Ages 2 – 5', description: 'Gentle, play-led learning focused on language, curiosity, and joyful foundations.' },
        { name: 'Primary School', ages: 'Ages 6 – 11', description: 'Strong foundations in reading, writing, mathematics, science, and creative arts.' },
        { name: 'Junior Secondary', ages: 'Ages 11 – 14', description: 'Broad exploration across sciences, humanities, languages, and technology.' },
        { name: 'Senior Secondary', ages: 'Ages 14 – 17', description: 'Rigorous subject depth, leadership, and comprehensive university preparation.' },
      ],
    },
    admissions: {
      text: admissionsContent.text || `Joining ${tenant.name} is the first step toward a bright future. We invite prospective families to discover our supportive academic community.`,
      requirements: admissionsContent.requirements || [
        'Completed Online Admission Application Form',
        'Official academic transcript / report cards from previous school (last 2 terms)',
        'Copy of Birth Certificate & 2 recent passport photographs',
        'Placement conversation / age-appropriate entrance assessment',
      ],
      process: admissionsContent.process || [
        { step: 1, title: 'Enquire', desc: 'Send us a short message or request a callback from our admissions office.' },
        { step: 2, title: 'Visit', desc: 'Tour the campus, explore classrooms, and meet our teachers in person.' },
        { step: 3, title: 'Apply', desc: 'Submit the application form and documents; we confirm placement promptly.' },
      ],
      feeGuideText: admissionsContent.feeGuideText || 'Our tuition structure is transparent and structured across terms. Scholarships and sibling discounts are available upon application.',
    },
    contact: {
      email: contactContent.email || `admissions@${tenant.slug}.edu`,
      phone: contactContent.phone || '+1 (555) 010-2000',
      whatsapp: contactContent.whatsapp || null,
      address: contactContent.address || `${tenant.name} Campus`,
      officeHours: contactContent.officeHours || 'Monday – Friday: 7:30 AM – 4:30 PM',
    },
    gallery: galleryImagesList,
  };
}

/**
 * Updates site content section for a tenant (§7A).
 */
export async function updateSiteContent(
  tenantId: string,
  page: 'home' | 'about' | 'academics' | 'contact' | 'admissions',
  contentData: Record<string, any>
) {
  const existing = await prisma.siteContent.findUnique({
    where: {
      tenantId_page: {
        tenantId,
        page,
      },
    },
  });

  const mergedContent = {
    ...((existing?.content as Record<string, any>) || {}),
    ...contentData,
  };

  const updated = await prisma.siteContent.upsert({
    where: {
      tenantId_page: {
        tenantId,
        page,
      },
    },
    update: {
      content: mergedContent,
    },
    create: {
      tenantId,
      page,
      content: mergedContent,
    },
  });

  return updated;
}

/**
 * Adds a photo gallery image for a tenant (§7A).
 */
export async function addGalleryImage(
  tenantId: string,
  imageUrl: string,
  caption?: string,
  album?: string
) {
  if (!imageUrl) throw new Error('Image URL is required');

  const image = await prisma.galleryImage.create({
    data: {
      tenantId,
      imageUrl,
      caption: caption || null,
      album: album || 'General',
    },
  });

  return image;
}

/**
 * Deletes a photo gallery image for a tenant (§7A).
 */
export async function deleteGalleryImage(tenantId: string, imageId: string) {
  const image = await prisma.galleryImage.findFirst({
    where: { id: imageId, tenantId },
  });

  if (!image) {
    throw new Error('Gallery image not found or tenant mismatch');
  }

  await prisma.galleryImage.delete({
    where: { id: imageId },
  });

  return { success: true, id: imageId };
}
