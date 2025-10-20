import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  handleApiError,
  AuthenticationError,
  ValidationError,
} from '@/lib/api-errors';
import { logger } from '@/lib/logger';
import { upsertAliasSet } from '@/lib/db/aliases-service';
import { checkWorkspaceMembership } from '@/lib/db/workspace-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    logger.info('[Aliases API] Adding manual alias set');

    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      logger.error('[Aliases API] No authenticated user');
      throw new AuthenticationError('Please log in to use this feature');
    }

    const { id: companyId } = params;
    const body = await request.json();
    const { original, variations, workspaceId, confidence } = body;

    if (!original) {
      throw new ValidationError('Original brand name is required');
    }

    if (!variations || !Array.isArray(variations) || variations.length === 0) {
      throw new ValidationError('At least one variation is required');
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

    await upsertAliasSet({
      companyId,
      original,
      variations,
      confidence: confidence || 1.0,
      scope: 'workspace',
      workspaceId,
      userId: sessionResponse.user.id,
    });

    logger.info('[Aliases API] Alias set added', {
      companyId,
      original,
      variationsCount: variations.length,
      workspaceId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
