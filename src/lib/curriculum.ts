import prisma from './prisma';
export * from './curriculum-types';
import { TenantCurriculumConfig } from './curriculum-types';

/**
 * Retrieves the tenant's class curriculum configuration.
 * Falls back to an empty structure if not yet customized.
 */
export async function getTenantCurriculum(tenantId: string): Promise<TenantCurriculumConfig> {
  try {
    const record = await prisma.siteContent.findUnique({
      where: {
        tenantId_page: {
          tenantId,
          page: 'curriculum',
        },
      },
    });

    if (record && record.content && typeof record.content === 'object') {
      const content = record.content as any;
      if (content.classes && typeof content.classes === 'object') {
        return content as TenantCurriculumConfig;
      }
    }
  } catch (err) {
    console.warn('[getTenantCurriculum error]', err);
  }

  return { classes: {} };
}

/**
 * Saves the tenant's class curriculum configuration.
 */
export async function saveTenantCurriculum(
  tenantId: string,
  config: TenantCurriculumConfig
): Promise<void> {
  await prisma.siteContent.upsert({
    where: {
      tenantId_page: {
        tenantId,
        page: 'curriculum',
      },
    },
    create: {
      tenantId,
      page: 'curriculum',
      content: config as any,
    },
    update: {
      content: config as any,
    },
  });
}
