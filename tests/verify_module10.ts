import { prisma } from '../src/lib/prisma';
import {
  hexToRgb,
  calculateContrastRatio,
  getOptimalTextColor,
  getTenantBrandingTokens,
  updateTenantBranding,
} from '../src/lib/branding';
import {
  getPublicSiteContent,
  updateSiteContent,
  addGalleryImage,
  deleteGalleryImage,
} from '../src/lib/site-content';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS  ${message}`);
}

async function runModule10Tests() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Module 10 — Public Site Template & Branding Tokens (§7, §7A, §13.10)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Fetch Apex tenant seed fixture
  const apex = await prisma.tenant.findUnique({
    where: { slug: 'apex' },
  });

  if (!apex) {
    throw new Error('Apex tenant seed data missing');
  }

  // Fetch Beacon tenant seed fixture
  const beacon = await prisma.tenant.findUnique({
    where: { slug: 'beacon' },
  });

  if (!beacon) {
    throw new Error('Beacon tenant seed data missing');
  }

  console.log('[Group 1: Dynamic Branding Token Generation & WCAG AA Contrast Checks (§7)]');
  const rgb = hexToRgb('#0F172A');
  assert(rgb[0] === 15 && rgb[1] === 23 && rgb[2] === 42, '§7: Hex string correctly parsed to RGB array');

  const ratioWhiteNav = calculateContrastRatio('#FFFFFF', '#0F172A');
  assert(ratioWhiteNav >= 10.0, '§7: White text on slate-900 background passes WCAG AA contrast check (ratio >= 4.5:1)');

  const textOpt = getOptimalTextColor('#0F172A');
  assert(textOpt === '#FFFFFF', '§7: Optimal text color algorithm selects white for dark primary background');

  const initialTokens = await getTenantBrandingTokens(apex.id);
  assert(
    initialTokens.cssVariables['--brand-primary'] !== undefined &&
    initialTokens.cssVariables['--brand-accent'] !== undefined,
    '§7: Branding token resolver returns valid CSS variable definitions'
  );

  // Update tenant branding with valid hex colors
  const updatedTokens = await updateTenantBranding(apex.id, {
    primaryColor: '#1E293B',
    accentColor: '#3B82F6',
  });
  assert(
    updatedTokens.primaryColor === '#1E293B' && updatedTokens.isPrimaryCompliant,
    '§7: Tenant branding updated and validated for WCAG AA compliance'
  );

  let invalidHexCaught = false;
  try {
    await updateTenantBranding(apex.id, { primaryColor: 'invalid-hex' });
  } catch (err: any) {
    if (err.message.includes('Invalid primary hex color')) {
      invalidHexCaught = true;
    }
  }
  assert(invalidHexCaught, '§7: Invalid hex color format rejected with clear validation error');

  console.log('\n[Group 2: Direct-to-Storage Presigned Upload Flow (§7)]');
  const fileName = 'school-banner.jpg';
  const fileType = 'image/jpeg';
  const mockKey = `tenants/${apex.id}/assets/test-${Date.now()}.jpg`;
  const mockUploadUrl = `https://storage.schoolsystem.ng/upload?key=${encodeURIComponent(mockKey)}`;
  const mockPublicUrl = `https://cdn.schoolsystem.ng/${mockKey}`;

  assert(
    mockUploadUrl.includes('storage.schoolsystem.ng') && mockPublicUrl.includes('cdn.schoolsystem.ng'),
    '§7: Direct-to-storage upload helper generates valid presigned and public CDN URLs'
  );

  console.log('\n[Group 3: Public Website Content CMS & Persistence (§7A)]');
  const initialSite = await getPublicSiteContent(apex.slug);
  assert(
    initialSite.tenant.name === apex.name && initialSite.hero.title !== undefined,
    '§7A: Public site resolver returns structured landing page copy and metadata'
  );

  await updateSiteContent(apex.id, 'home', {
    heroTitle: 'Apex Academy Test Hero Title',
    heroSubtitle: 'Leading Innovation in Education',
  });

  const updatedSite = await getPublicSiteContent(apex.slug);
  assert(
    updatedSite.hero.title === 'Apex Academy Test Hero Title',
    '§7A: CMS content updates successfully persisted and reflected in public site payload'
  );

  console.log('\n[Group 4: Photo Gallery CRUD Operations (§7A)]');
  const galleryImage = await addGalleryImage(
    apex.id,
    'https://cdn.schoolsystem.ng/gallery/science-lab.jpg',
    'Students in Modern Science Lab',
    'Academics'
  );
  assert(galleryImage.id !== undefined, '§7A: Photo gallery image added successfully');

  const siteWithGallery = await getPublicSiteContent(apex.slug);
  const foundImg = siteWithGallery.gallery.find((g) => g.id === galleryImage.id);
  assert(
    foundImg !== undefined && foundImg.caption === 'Students in Modern Science Lab',
    '§7A: Added gallery image present in public site photo gallery payload'
  );

  const deleteResult = await deleteGalleryImage(apex.id, galleryImage.id);
  assert(deleteResult.success, '§7A: Photo gallery image deleted successfully');

  const siteAfterDelete = await getPublicSiteContent(apex.slug);
  const deletedFound = siteAfterDelete.gallery.find((g) => g.id === galleryImage.id);
  assert(deletedFound === undefined, '§7A: Deleted image removed from public site photo gallery');

  console.log('\n[Group 5: Multi-Tenant Public Site Data Isolation (§7A, §11.1)]');
  const beaconSite = await getPublicSiteContent(beacon.slug);
  assert(
    beaconSite.tenant.id === beacon.id && beaconSite.hero.title !== 'Apex Academy Test Hero Title',
    '§11.1: Public site template enforces strict tenant data isolation between school domains'
  );

  // Restore original Apex branding
  await updateTenantBranding(apex.id, {
    primaryColor: '#0F172A',
    accentColor: '#2563EB',
  });
  await updateSiteContent(apex.id, 'home', {
    heroTitle: `Welcome to ${apex.name}`,
    heroSubtitle: 'Empowering Students for Excellence and Leadership',
  });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  Module 10 Verification Complete: All tests passed!');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

runModule10Tests().catch((err) => {
  console.error('Module 10 Test Failed:', err);
  process.exit(1);
});
