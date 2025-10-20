/**
 * Workspace service - Multi-tenant workspace management
 * Handles workspace creation, membership, and default workspace resolution
 */

import { db } from '@/lib/db';
import { workspaces, workspaceMembers, type Workspace, type WorkspaceMember } from '@/lib/db/schema/companies';
import { eq, and } from 'drizzle-orm';

export async function getUserDefaultWorkspace(userId: string): Promise<string> {
  const existingMembership = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);

  if (existingMembership.length > 0) {
    return existingMembership[0].workspaceId;
  }

  const [newWorkspace] = await db
    .insert(workspaces)
    .values({
      name: `Workspace personnel`,
    })
    .returning();

  await db.insert(workspaceMembers).values({
    workspaceId: newWorkspace.id,
    userId,
    role: 'owner',
  });

  return newWorkspace.id;
}

export async function checkWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<WorkspaceMember | null> {
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);

  return membership || null;
}

export async function getUserWorkspaces(userId: string): Promise<
  Array<{
    workspace: Workspace;
    membership: WorkspaceMember;
  }>
> {
  const results = await db
    .select({
      workspace: workspaces,
      membership: workspaceMembers,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));

  return results;
}

export async function createWorkspace(
  name: string,
  userId: string
): Promise<Workspace> {
  const [workspace] = await db
    .insert(workspaces)
    .values({ name })
    .returning();

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId,
    role: 'owner',
  });

  return workspace;
}

export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: 'owner' | 'admin' | 'member' | 'viewer' = 'member'
): Promise<void> {
  await db
    .insert(workspaceMembers)
    .values({
      workspaceId,
      userId,
      role,
    })
    .onConflictDoNothing();
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<void> {
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    );
}
