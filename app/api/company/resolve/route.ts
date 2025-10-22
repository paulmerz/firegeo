import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  handleApiError,
  AuthenticationError,
  ValidationError,
} from '@/lib/api-errors';
import { logger } from '@/lib/logger';
import { getOrCreateCompanyByUrl, dbCompanyToAppCompany } from '@/lib/db/companies-service';
import { mergeCompetitorsForWorkspace } from '@/lib/db/competitors-service';
import { getAliasesForCompany } from '@/lib/db/aliases-service';
import { getUserDefaultWorkspace } from '@/lib/db/workspace-service';

export async function POST(request: NextRequest) {
  try {
    logger.info('[Company Resolve API] Starting company resolution');

    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      logger.error('[Company Resolve API] No authenticated user');
      throw new AuthenticationError('Please log in to use this feature');
    }

    const body = await request.json();
    const { url, locale, workspaceId: requestedWorkspaceId } = body;

    if (!url) {
      throw new ValidationError('URL is required');
    }

    const workspaceId =
      requestedWorkspaceId || (await getUserDefaultWorkspace(sessionResponse.user.id));

    const { company: dbCompany, isNew } = await getOrCreateCompanyByUrl({
      url,
      locale,
      workspaceId,
    });

    if (isNew) {
      logger.info('[Company Resolve API] Created new company stub', {
        companyId: dbCompany.id,
        domain: dbCompany.canonicalDomain,
      });

      return NextResponse.json({
        company: dbCompanyToAppCompany(dbCompany),
        competitors: [],
        aliases: {},
        isNew: true,
      });
    }

    const [competitors, aliases] = await Promise.all([
      mergeCompetitorsForWorkspace({
        companyId: dbCompany.id,
        workspaceId,
        locale,
      }),
      getAliasesForCompany(dbCompany.id),
    ]);

    logger.info('[Company Resolve API] Resolved company', {
      companyId: dbCompany.id,
      competitorsCount: competitors.length,
      aliasesCount: Object.keys(aliases).length,
    });

    return NextResponse.json({
      company: dbCompanyToAppCompany(dbCompany),
      competitors,
      aliases: { [dbCompany.name]: aliases },
      isNew: false,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
