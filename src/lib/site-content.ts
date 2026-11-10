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
    anthem?: string;
  };
  academics: {
    text: string;
    highlights: string[];
    curricula: string[];
    levels: Array<{ name: string; description: string; ages: string }>;
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
      principalMessage: aboutContent.principalMessage || `At ${tenant.name}, we believe every child possesses innate gifts waiting to be unlocked. Our dedicated faculty fosters an environment of curiosity, resilience, and compassion. We welcome you to experience our vibrant community where academic rigor and character building walk hand in hand.`,
      anthem: aboutContent.anthem || `Forward ever, backward never, shining brightly as the stars. In truth and knowledge we strive, building future leaders for our nation.`,
    },
    academics: {
      text: academicsContent.text || 'We offer a comprehensive curriculum designed to nurture critical thinking, creativity, and STEM capabilities.',
      highlights: academicsContent.highlights || ['Nursery & Early Years Foundation', 'Primary Education & Cambridge Checkpoint', 'Junior Secondary (BECE/NECO)', 'Senior Secondary (WAEC/WASSCE & UTME)'],
      curricula: academicsContent.curricula || ['Nigerian National Curriculum (NERDC)', 'British Cambridge Assessment International Curriculum', 'Advanced STEM & Robotics Coding Academy'],
      levels: academicsContent.levels || [
        { name: 'Early Childhood & Nursery', ages: 'Ages 2 - 5', description: 'Montessori-inspired play, literacy foundations, and emotional development.' },
        { name: 'Lower & Upper Primary', ages: 'Ages 6 - 11', description: 'Core numeracy, science discovery, creative arts, and ICT literacy.' },
        { name: 'Junior Secondary School', ages: 'Ages 11 - 14', description: 'Broad-based exploration spanning sciences, humanities, and business studies.' },
        { name: 'Senior Secondary School', ages: 'Ages 14 - 17', description: 'Specialized tracks in Science, Arts, and Commercial with comprehensive exam prep.' },
      ],
    },
    admissions: {
      text: admissionsContent.text || `Joining ${tenant.name} is the first step toward a bright future. We invite prospective families to discover our supportive academic community.`,
      requirements: admissionsContent.requirements || [
        'Completed Online Admission Application Form',
        'Official academic transcript / report cards from previous school (last 2 terms)',
        'Copy of Child Birth Certificate & 2 recent passport photographs',
        'Satisfactory score on entrance assessment (Mathematics, English & General Paper)',
      ],
      process: admissionsContent.process || [
        { step: 1, title: 'Inquiry & School Tour', desc: 'Book a campus walkthrough and speak directly with our admissions counsellors.' },
        { step: 2, title: 'Application Submission', desc: 'Submit the registration form along with required academic credentials.' },
        { step: 3, title: 'Entrance Assessment', desc: 'Student participates in an age-appropriate aptitude and placement evaluation.' },
        { step: 4, title: 'Offer & Enrollment', desc: 'Successful applicants receive formal admission letters and onboarding pack.' },
      ],
      feeGuideText: admissionsContent.feeGuideText || 'Our tuition structure is transparent and structured across terms. Scholarships and sibling discounts are available upon application.',
    },
    contact: {
      email: contactContent.email || `info@${tenant.slug}.edu.ng`,
      phone: contactContent.phone || '+234 800 000 0000',
      address: contactContent.address || 'School Campus Address, Victoria Island, Lagos, Nigeria',
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
