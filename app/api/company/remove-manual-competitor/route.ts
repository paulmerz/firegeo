import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  handleApiError,
  AuthenticationError,
  ValidationError,
} from '@/lib/api-errors';
import { logger } from '@/lib/logger';
import { getOrCreateCompanyByUrl } from '@/lib/db/companies-service';
import { db } from '@/lib/db';
import { competitorEdgeOverrides } from '@/lib/db/schema/companies';
// No additional imports needed for this operation

export async function DELETE(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to use this feature');
    }

    const body = await request.json();
    const { companyUrl, competitorUrl, workspaceId } = body as {
      companyUrl?: string;
      competitorUrl?: string;
      workspaceId?: string;
    };

    if (!companyUrl || !competitorUrl || !workspaceId) {
      throw new ValidationError('companyUrl, competitorUrl, workspaceId are required');
    }

    const { company: mainCompany } = await getOrCreateCompanyByUrl({ url: companyUrl, workspaceId });
    const { company: competitorCompany } = await getOrCreateCompanyByUrl({ url: competitorUrl, workspaceId });

    // Upsert override hidden=true (masquer le concurrent)
    const result = await db
      .insert(competitorEdgeOverrides)
      .values({
        companyId: mainCompany.id,
        competitorId: competitorCompany.id,
        workspaceId,
        hidden: true, // Masquer
        pinned: false,
        createdByUserId: sessionResponse.user.id,
        updatedByUserId: sessionResponse.user.id,
      })
      .onConflictDoUpdate({
        target: [
          competitorEdgeOverrides.companyId,
          competitorEdgeOverrides.competitorId,
          competitorEdgeOverrides.workspaceId,
        ],
        set: {
          hidden: true,
          updatedByUserId: sessionResponse.user.id,
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log('[DEBUG] Override created/updated:', result);
    logger.info('[Remove Manual Competitor API] Override hidden=true', {
      companyId: mainCompany.id,
      competitorId: competitorCompany.id,
      workspaceId,
      result,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}


