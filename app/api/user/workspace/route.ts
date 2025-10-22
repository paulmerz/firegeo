import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  handleApiError,
  AuthenticationError,
} from '@/lib/api-errors';
import { getUserDefaultWorkspace } from '@/lib/db/workspace-service';

export async function GET(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to use this feature');
    }

    const workspaceId = await getUserDefaultWorkspace(sessionResponse.user.id);

    return NextResponse.json({
      workspaceId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
