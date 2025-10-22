import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  handleApiError,
  AuthenticationError,
  ValidationError,
} from '@/lib/api-errors';
import { logger } from '@/lib/logger';
import { getOrCreateCompanyByUrl } from '@/lib/db/companies-service';
import { saveManualCompetitor } from '@/lib/db/competitors-service';

export async function POST(request: NextRequest) {
  try {
    logger.info('[Save Manual Competitor API] Starting manual competitor save');

    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      logger.error('[Save Manual Competitor API] No authenticated user');
      throw new AuthenticationError('Please log in to use this feature');
    }

    const body = await request.json();
    const { companyUrl, competitorName, competitorUrl, workspaceId } = body;

    if (!companyUrl || !competitorName || !competitorUrl || !workspaceId) {
      throw new ValidationError('Company URL, competitor name, competitor URL, and workspace ID are required');
    }

    // Récupérer ou créer la company principale
    const { company: mainCompany } = await getOrCreateCompanyByUrl({
      url: companyUrl,
      workspaceId,
    });

    // Sauvegarder le concurrent manuel
    await saveManualCompetitor({
      companyId: mainCompany.id,
      competitorName,
      competitorUrl,
      workspaceId,
      userId: sessionResponse.user.id,
    });

    logger.info('[Save Manual Competitor API] Manual competitor saved', {
      companyId: mainCompany.id,
      competitorName,
    });

    return NextResponse.json({
      success: true,
      message: 'Manual competitor saved successfully',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
