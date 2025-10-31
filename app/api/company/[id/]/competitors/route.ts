import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  handleApiError,
  AuthenticationError,
  ValidationError,
} from '@/lib/api-errors';
import { logger } from '@/lib/logger';
import { upsertCompetitorEdge } from '@/lib/db/competitors-service';
import { checkWorkspaceMembership } from '@/lib/db/workspace-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    logger.info('[Competitors API] Adding manual competitor');

    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      logger.error('[Competitors API] No authenticated user');
      throw new AuthenticationError('Please log in to use this feature');
    }

    const { id: companyId } = params;
    const body = await request.json();
    const { competitorName, competitorUrl, workspaceId, score } = body;

    if (!competitorName) {
      throw new ValidationError('Competitor name is required');
    }

    if (!workspaceId) {
      throw new ValidationError('Workspace ID is required');
    }

    const membership = await checkWorkspaceMembership(
      sessionResponse.user.id,
      workspaceId
    );

    if (!membership) {
      throw new AuthenticationError('You do not have access to this workspace');
    }

    await upsertCompetitorEdge({
      companyId,
      competitorName,
      competitorUrl,
      score: score || 5,
      source: 'user',
      scope: 'workspace',
      workspaceId,
      userId: sessionResponse.user.id,
    });

    logger.info('[Competitors API] Competitor added', {
      companyId,
      competitorName,
      workspaceId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
