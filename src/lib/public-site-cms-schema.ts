export type CmsPageKey = 'home' | 'services' | 'pricing' | 'about';

export type CmsBlockType =
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'columns'
  | 'spacer'
  | 'divider'
  | 'hero'
  | 'capabilities'
  | 'showcase'
  | 'roles'
  | 'plans'
  | 'faq'
  | 'cta'
  | 'custom_text'
  | 'testimonials'
  | 'stats'
  | 'video'
  | 'contact_form'
  | 'logo_strip';

export interface CmsBlockStyle {
  bgColor?: string;
  bgImage?: string;
  bgOverlayOpacity?: number;
  bgGradient?: string;
  textColor?: string;
  accentColor?: string;
  fontSize?: number;
  fontWeight?: '400' | '500' | '600' | '700' | '800';
  textAlign?: 'left' | 'center' | 'right';
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
}

export interface CmsBlockAdvanced {
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  marginTop?: number;
  marginBottom?: number;
  maxWidth?: 'full' | '7xl' | '5xl' | '3xl';
  hideDesktop?: boolean;
  hideTablet?: boolean;
  hideMobile?: boolean;
  cssId?: string;
  cssClass?: string;
}

export interface CmsNavLink {
  label: string;
  href: string;
}

export interface CmsFooterColumn {
  heading: string;
  links: CmsNavLink[];
}

export interface CmsBrandConfig {
  name: string;
  tagline: string;
  logoUrl: string;
  faviconUrl?: string;
  primaryColor: string;
  accentColor: string;
  adminThemePreset?: 'ledger' | 'brand' | 'emerald' | 'custom';
  adminAccentColor?: string;
  fontPreset?: 'editorial' | 'modern' | 'classic';
  buttonRadius?: 'sharp' | 'soft' | 'pill';
  footerNote: string;
  headerCtaLabel?: string;
  headerCtaHref?: string;
  showSignInLink?: boolean;
  navLinks?: CmsNavLink[];
  footerColumns?: CmsFooterColumn[];
  footerCopyright?: string;
}

export const DEFAULT_NAV_LINKS: CmsNavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Platform', href: '/services' },
  { label: 'Plans', href: '/pricing' },
  { label: 'Schools', href: '/schools' },
  { label: 'About', href: '/about' },
];

export function getDefaultFooterColumns(platformName = 'School Platform'): CmsFooterColumn[] {
  return [
    {
      heading: 'Platform',
      links: [
        { label: 'Home', href: '/' },
        { label: `What ${platformName} does`, href: '/services' },
        { label: 'Plans', href: '/pricing' },
        { label: 'Set up your school', href: '/register' },
      ],
    },
    {
      heading: 'About',
      links: [
        { label: 'About us', href: '/about' },
        { label: 'School directory', href: '/schools' },
      ],
    },
    {
      heading: 'Access',
      links: [
        { label: 'Find your school', href: '/schools' },
        { label: 'Admin sign in', href: '/admin/login' },
      ],
    },
  ];
}

export interface CmsBlock {
  id: string;
  type: CmsBlockType;
  visible: boolean;
  data: Record<string, any>;
  style?: CmsBlockStyle;
  advanced?: CmsBlockAdvanced;
}

export interface CmsCustomPage {
  slug: string;
  title: string;
  description: string;
  published: boolean;
  blocks: CmsBlock[];
  updatedAt?: string;
}

export interface CmsMediaAsset {
  id: string;
  url: string;
  name: string;
  createdAt: string;
}

export interface CmsPageSeo {
  title?: string;
  description?: string;
  ogImage?: string;
}

export interface PublicSiteCmsConfig {
  brand: CmsBrandConfig;
  pages: Record<CmsPageKey, CmsBlock[]>;
  customPages?: CmsCustomPage[];
  mediaLibrary?: CmsMediaAsset[];
  pageSeo?: Record<string, CmsPageSeo>;
  blocks?: CmsBlock[];
}

export interface CmsPageSummary {
  key: string;
  title: string;
  route: string;
  description: string;
  isBuiltIn: boolean;
  published: boolean;
  blockCount: number;
}

export function getAllCmsPagesMeta(config: PublicSiteCmsConfig): CmsPageSummary[] {
  const builtIn: CmsPageSummary[] = CMS_PAGES.map((p) => ({
    key: p.key,
    title: p.title,
    route: p.route,
    description: p.description,
    isBuiltIn: true,
    published: true,
    blockCount: (config.pages[p.key] || []).length,
  }));

  const custom: CmsPageSummary[] = (config.customPages || []).map((cp) => ({
    key: cp.slug,
    title: cp.title,
    route: `/p/${cp.slug}`,
    description: cp.description || 'Custom page',
    isBuiltIn: false,
    published: cp.published,
    blockCount: (cp.blocks || []).length,
  }));

  return [...builtIn, ...custom];
}

export function sanitizePageSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const CMS_PAGES: Array<{
  key: CmsPageKey;
  title: string;
  route: string;
  description: string;
}> = [
  {
    key: 'home',
    title: 'Home Page',
    route: '/',
    description: 'Main landing page with hero, product showcase, capabilities, plans, and CTA.',
  },
  {
    key: 'services',
    title: 'Platform & Services',
    route: '/services',
    description: 'Detailed walkthrough of attendance, fees, assessments, CBT, and school websites.',
  },
  {
    key: 'pricing',
    title: 'Plans & Pricing',
    route: '/pricing',
    description: 'Subscription tiers synced from your database plans plus billing FAQ.',
  },
  {
    key: 'about',
    title: 'About Us',
    route: '/about',
    description: 'Platform story, mission, role breakdown, and onboarding call-to-action.',
  },
];

export function isValidCmsPageKey(value: string): value is CmsPageKey {
  return value === 'home' || value === 'services' || value === 'pricing' || value === 'about';
}

export const CMS_BLOCK_CATALOG: Array<{
  type: CmsBlockType;
  category: 'Basic' | 'Layout' | 'Platform';
  label: string;
  description: string;
}> = [
  // Basic Widgets
  { type: 'heading', category: 'Basic', label: 'Heading', description: 'Editable H1–H6 title with full typography & alignment.' },
  { type: 'text', category: 'Basic', label: 'Text Editor', description: 'Multi-line editorial copy or announcement paragraph.' },
  { type: 'image', category: 'Basic', label: 'Image', description: 'Responsive image widget with caption and link.' },
  { type: 'button', category: 'Basic', label: 'Button', description: 'Standalone call-to-action button with custom link.' },
  // Layout Widgets
  { type: 'columns', category: 'Layout', label: 'Columns Grid', description: '2 or 3 side-by-side content columns.' },
  { type: 'spacer', category: 'Layout', label: 'Spacer', description: 'Adjustable vertical breathing room.' },
  { type: 'divider', category: 'Layout', label: 'Divider', description: 'Clean horizontal separator rule.' },
  // Platform Section Widgets
  { type: 'hero', category: 'Platform', label: 'Hero Banner', description: 'Headline, value proposition, CTAs, and live product preview.' },
  { type: 'capabilities', category: 'Platform', label: 'Capabilities Grid', description: 'Structured multi-column list of platform strengths.' },
  { type: 'showcase', category: 'Platform', label: 'Workspace Showcase', description: 'Split layout highlighting the school workspace interface.' },
  { type: 'roles', category: 'Platform', label: 'Role Breakdown', description: 'Overview for school owners, teachers, and families.' },
  { type: 'plans', category: 'Platform', label: 'Pricing Plans', description: 'Live subscription tiers pulled from your database.' },
  { type: 'faq', category: 'Platform', label: 'FAQ Accordion', description: 'Expandable questions and answers.' },
  { type: 'cta', category: 'Platform', label: 'Call to Action', description: 'Conversion banner with primary action button.' },
  { type: 'custom_text', category: 'Platform', label: 'Story Banner', description: 'Full-bleed editorial text section with CTA.' },
  { type: 'testimonials', category: 'Platform', label: 'Testimonials', description: 'Quotes from school owners, principals, and parents.' },
  { type: 'stats', category: 'Platform', label: 'Stats Counter', description: 'Key platform metrics strip (schools, students, uptime).' },
  { type: 'video', category: 'Platform', label: 'Video Demo', description: 'YouTube, Vimeo, or MP4 walkthrough video section.' },
  { type: 'contact_form', category: 'Platform', label: 'Lead / Contact Form', description: 'Interactive demo & inquiry form saved to Super Admin Leads.' },
  { type: 'logo_strip', category: 'Platform', label: 'Trusted Schools', description: 'Row of partner school names or logos.' },
];

export function createDefaultBlock(type: CmsBlockType, platformName = 'School Platform'): CmsBlock {
  const id = `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const baseAdvanced: CmsBlockAdvanced = {
    maxWidth: '7xl',
  };

  switch (type) {
    case 'heading':
      return {
        id,
        type,
        visible: true,
        data: {
          text: 'Add your heading text here',
          tag: 'h2',
        },
        style: { fontSize: 36, fontWeight: '700', textAlign: 'left' },
        advanced: { ...baseAdvanced, paddingTop: 32, paddingBottom: 16 },
      };

    case 'text':
      return {
        id,
        type,
        visible: true,
        data: {
          content:
            'Click to edit this text block. Write clear copy about your school management platform, onboarding workflow, or institutional standards.',
        },
        style: { fontSize: 16, fontWeight: '400', textAlign: 'left' },
        advanced: { ...baseAdvanced, paddingTop: 12, paddingBottom: 24 },
      };

    case 'image':
      return {
        id,
        type,
        visible: true,
        data: {
          src: '',
          alt: `${platformName} preview`,
          caption: 'Add an image URL in the Content tab',
          aspectRatio: '16/9',
        },
        style: { borderRadius: 0 },
        advanced: { ...baseAdvanced, paddingTop: 24, paddingBottom: 24 },
      };

    case 'button':
      return {
        id,
        type,
        visible: true,
        data: {
          label: 'Get started now',
          href: '/register',
          variant: 'solid',
        },
        style: { textAlign: 'left', borderRadius: 6 },
        advanced: { ...baseAdvanced, paddingTop: 16, paddingBottom: 24 },
      };

    case 'columns':
      return {
        id,
        type,
        visible: true,
        data: {
          columnCount: 3,
          items: [
            { title: 'Column one', body: 'Describe a key feature, metric, or highlight here.' },
            { title: 'Column two', body: 'Each column can be edited independently in Content.' },
            { title: 'Column three', body: 'Switch between 2 or 3 columns anytime.' },
          ],
        },
        style: { bgColor: '#ffffff' },
        advanced: { ...baseAdvanced, paddingTop: 48, paddingBottom: 48 },
      };

    case 'spacer':
      return {
        id,
        type,
        visible: true,
        data: { height: 48 },
        advanced: { maxWidth: 'full' },
      };

    case 'divider':
      return {
        id,
        type,
        visible: true,
        data: { thickness: 1 },
        style: { borderColor: '#e4e2dd' },
        advanced: { ...baseAdvanced, paddingTop: 20, paddingBottom: 20 },
      };

    case 'hero':
      return {
        id,
        type: 'hero',
        visible: true,
        data: {
          headline: 'A clear view of your school,',
          highlight: 'every day.',
          subtitle:
            'Bring attendance, fee records, term results, and parent access into one practical workspace for your school team.',
          primaryCtaLabel: 'Set up your school',
          primaryCtaHref: '/register',
          secondaryCtaLabel: `Explore ${platformName}`,
          secondaryCtaHref: '/services',
          audienceTags: ['For school owners', 'For teachers', 'For families'],
          showProductPreview: true,
        },
      };

    case 'capabilities':
      return {
        id,
        type: 'capabilities',
        visible: true,
        data: {
          heading: 'Give every task a clear next step.',
          subtitle:
            'The school office, teachers, and families each need different information. Keep everything in one system while giving each person the access they need.',
          items: [
            { title: 'Attendance & records', description: 'Keep class registers, student records, and staff information organised.' },
            { title: 'Fees & follow-up', description: 'Record school fees and see which balances need attention.' },
            { title: 'Term results', description: 'Move assessment work through review and report-card publishing.' },
            { title: 'Family access', description: 'Give parents a clear way to reach school updates and published results.' },
          ],
        },
      };

    case 'showcase':
      return {
        id,
        type: 'showcase',
        visible: true,
        data: {
          heading: 'Know what needs attention.',
          body: 'Keep records, fee follow-up, and term results in the same workspace. Staff can see the next task and continue the work without rebuilding details in separate files.',
          bullets: [
            'Student and staff records',
            'Attendance and fee workflows',
            'Results review and report cards',
          ],
          ctaLabel: 'See how the platform works',
          ctaHref: '/services',
        },
      };

    case 'roles':
      return {
        id,
        type: 'roles',
        visible: true,
        data: {
          heading: 'A useful view for each role.',
          subtitle:
            'Owners need oversight. Teachers need simple academic workflows. Families need access to the information their school shares.',
          items: [
            { role: 'School owners', description: 'Oversee school records, plan access, fee activity, and the work moving through each term.' },
            { role: 'Teachers', description: 'Record attendance and assessment work, then send results through the school’s review process.' },
            { role: 'Families', description: 'Use the school portal to check published information, results, and updates shared with them.' },
          ],
        },
      };

    case 'plans':
      return {
        id,
        type: 'plans',
        visible: true,
        data: {
          heading: 'Choose what fits your school.',
          subtitle: 'Plans scale cleanly with your student enrollment.',
          compareLabel: 'Compare all plan details',
          compareHref: '/pricing',
          footerNote: 'Custom school domains are available on eligible plans.',
        },
      };

    case 'faq':
      return {
        id,
        type: 'faq',
        visible: true,
        data: {
          heading: 'Frequently asked questions',
          items: [
            {
              question: 'How does the student ceiling work?',
              answer: 'It is the maximum number of active students included in the plan. Choose a plan with enough room for your current enrollment.',
            },
            {
              question: 'Does every school get its own public website?',
              answer: 'Yes. Each school gets a branded public website, portal login, and online result checker.',
            },
            {
              question: 'Can parents check results and fees online?',
              answer: 'Parents and students sign into their dedicated portal or verify results with termly PINs.',
            },
          ],
        },
      };

    case 'cta':
      return {
        id,
        type: 'cta',
        visible: true,
        data: {
          heading: 'Make the school day easier to keep on track.',
          subtitle: 'Set up the workspace around your school, then bring your team into one shared system.',
          buttonLabel: 'Set up your school',
          buttonHref: '/register',
        },
      };

    case 'testimonials':
      return {
        id,
        type,
        visible: true,
        data: {
          heading: 'Trusted by school leaders',
          subtitle: 'How proprietors, principals, and teachers use the platform every term.',
          items: [
            {
              quote: 'Result compilation that used to take two weeks now wraps up in one afternoon, and parents check report cards without queuing at the bursar office.',
              author: 'Mrs. Adebayo O.',
              role: 'Proprietress, Greenfield Academy',
            },
            {
              quote: 'Attendance registers, fee receipts, and CBT exams finally live in one calm place our teachers actually enjoy using.',
              author: 'Mr. Chinedu K.',
              role: 'Principal, Crestview College',
            },
            {
              quote: 'Having our own school website, admissions form, and parent portal set up on day one elevated how families see our school.',
              author: 'Dr. Zainab M.',
              role: 'Director, Heritage International',
            },
          ],
        },
      };

    case 'stats':
      return {
        id,
        type,
        visible: true,
        data: {
          heading: 'Built for reliability at school scale',
          items: [
            { value: '120+', label: 'Active schools' },
            { value: '45,000+', label: 'Students managed' },
            { value: '99.9%', label: 'Term-time uptime' },
            { value: '< 5 min', label: 'School setup time' },
          ],
        },
      };

    case 'video':
      return {
        id,
        type,
        visible: true,
        data: {
          heading: 'See the workspace in action',
          subtitle: 'Take a two-minute tour of attendance, fee tracking, CBT exams, and automated report cards.',
          videoUrl: '',
          caption: 'Paste any YouTube, Vimeo, or MP4 URL in the Content tab.',
        },
      };

    case 'contact_form':
      return {
        id,
        type,
        visible: true,
        data: {
          heading: 'Book a live walkthrough',
          subtitle: 'Tell us about your school and our onboarding team will reach out with a tailored demo.',
          buttonLabel: 'Request Demo',
          showSchoolField: true,
          showPhoneField: true,
        },
      };

    case 'logo_strip':
      return {
        id,
        type,
        visible: true,
        data: {
          heading: 'Trusted by forward-thinking schools',
          items: [
            { name: 'Greenfield Academy', logoUrl: '' },
            { name: 'Crestview College', logoUrl: '' },
            { name: 'Heritage International', logoUrl: '' },
            { name: 'Oakridge Montessori', logoUrl: '' },
            { name: 'Beacon Hill High', logoUrl: '' },
          ],
        },
      };

    case 'custom_text':
    default:
      return {
        id,
        type: 'custom_text',
        visible: true,
        data: {
          heading: 'Built for modern schools',
          body: 'Share announcements, onboarding notes, or partnership information directly on your public page.',
          buttonLabel: 'Learn more',
          buttonHref: '/about',
          backgroundTone: 'stone',
        },
      };
  }
}

export function getDefaultPageBlocks(
  pageKey: CmsPageKey,
  platformName = 'School Platform'
): CmsBlock[] {
  switch (pageKey) {
    case 'services':
      return [
        {
          id: 'services-hero',
          type: 'hero',
          visible: true,
          data: {
            headline: 'The tools that keep school work moving.',
            highlight: '',
            subtitle: `${platformName} connects school records, attendance, fees, academic results, and family access in one dedicated workspace for each school.`,
            primaryCtaLabel: 'Set up your school',
            primaryCtaHref: '/register',
            secondaryCtaLabel: 'Compare plans',
            secondaryCtaHref: '/pricing',
            audienceTags: ['Student & staff records', 'Fees & receipts', 'Results & CBT'],
            showProductPreview: false,
          },
        },
        {
          id: 'services-capabilities',
          type: 'capabilities',
          visible: true,
          data: {
            heading: 'Core platform capabilities',
            subtitle: 'Every school enables the modules included in its plan with clean role-based access.',
            items: [
              { title: 'Student & staff records', description: 'Keep class rosters, academic sessions, terms, and role-based staff records in one place.' },
              { title: 'Attendance & routines', description: 'Daily student class registers and staff attendance tracking with clear summaries.' },
              { title: 'Fees & payment ledgers', description: 'Define fee structures, record payments, verify bank transfers, and track balances.' },
              { title: 'Assessments & report cards', description: 'Move continuous assessment and exam scores cleanly through review to printable report cards.' },
              { title: 'CBT online examinations', description: 'Draft timed computer-based exams with auto-grading and instant score capture.' },
              { title: 'Branded school website', description: 'Each school gets its own public website, admissions inquiry form, gallery, and result checker.' },
            ],
          },
        },
        { ...createDefaultBlock('showcase', platformName), id: 'services-showcase' },
        { ...createDefaultBlock('cta', platformName), id: 'services-cta' },
      ];

    case 'pricing':
      return [
        {
          id: 'pricing-hero',
          type: 'hero',
          visible: true,
          data: {
            headline: 'Transparent plans for every school size.',
            highlight: '',
            subtitle: 'Choose an annual subscription plan matched to your student enrollment ceiling and included modules.',
            primaryCtaLabel: 'Start registration',
            primaryCtaHref: '/register',
            secondaryCtaLabel: 'Explore platform',
            secondaryCtaHref: '/services',
            audienceTags: ['Annual billing', 'No hidden fees', 'Upgrade anytime'],
            showProductPreview: false,
          },
        },
        {
          id: 'pricing-plans',
          type: 'plans',
          visible: true,
          data: {
            heading: 'Compare subscription plans',
            subtitle: 'All tiers include isolated school workspaces, staff dashboards, and parent/student portals.',
            compareLabel: '',
            compareHref: '/pricing',
            footerNote: 'Custom school domains are available on eligible tiers.',
          },
        },
        { ...createDefaultBlock('faq', platformName), id: 'pricing-faq' },
        { ...createDefaultBlock('cta', platformName), id: 'pricing-cta' },
      ];

    case 'about':
      return [
        {
          id: 'about-hero',
          type: 'hero',
          visible: true,
          data: {
            headline: 'School work is easier when the details connect.',
            highlight: '',
            subtitle: `${platformName} brings the everyday work of running a school into one calm system—from student records and attendance to fee follow-up, term results, and family access.`,
            primaryCtaLabel: 'Set up your school',
            primaryCtaHref: '/register',
            secondaryCtaLabel: 'Explore the platform',
            secondaryCtaHref: '/services',
            audienceTags: [],
            showProductPreview: false,
          },
        },
        {
          id: 'about-story',
          type: 'custom_text',
          visible: true,
          data: {
            heading: 'Made for the people who keep a school moving.',
            body: `School owners, teachers, and families need different views of the same school day. ${platformName} gives them a shared system for records, academic work, and the information each school chooses to publish.\n\nEach school sets up its own workspace and public website around its identity, with clean isolation and role-based permissions.`,
            buttonLabel: 'Explore features',
            buttonHref: '/services',
            backgroundTone: 'light',
          },
        },
        { ...createDefaultBlock('roles', platformName), id: 'about-roles' },
        { ...createDefaultBlock('cta', platformName), id: 'about-cta' },
      ];

    case 'home':
    default:
      return [
        { ...createDefaultBlock('hero', platformName), id: 'hero-main' },
        { ...createDefaultBlock('capabilities', platformName), id: 'capabilities-main' },
        { ...createDefaultBlock('showcase', platformName), id: 'showcase-main' },
        { ...createDefaultBlock('roles', platformName), id: 'roles-main' },
        { ...createDefaultBlock('plans', platformName), id: 'plans-main' },
        { ...createDefaultBlock('cta', platformName), id: 'cta-main' },
      ];
  }
}

export function getDefaultPublicSiteCms(
  platformName = 'School Platform',
  platformTagline = 'Multi-Tenant School Management Platform'
): PublicSiteCmsConfig {
  const homeBlocks = getDefaultPageBlocks('home', platformName);
  return {
    brand: {
      name: platformName,
      tagline: platformTagline,
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '#111315',
      accentColor: '#17834b',
      footerNote: 'School management for the people who keep each school day moving.',
      headerCtaLabel: 'Set up your school',
      headerCtaHref: '/register',
      showSignInLink: true,
      navLinks: DEFAULT_NAV_LINKS,
      footerColumns: getDefaultFooterColumns(platformName),
      footerCopyright: '',
    },
    pages: {
      home: homeBlocks,
      services: getDefaultPageBlocks('services', platformName),
      pricing: getDefaultPageBlocks('pricing', platformName),
      about: getDefaultPageBlocks('about', platformName),
    },
    customPages: [],
    mediaLibrary: [],
    blocks: homeBlocks,
  };
}
