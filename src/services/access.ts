import { prisma } from "../db";
import { Errors } from "../errors";

export interface MembershipContext {
  groupId: string;
  userId: string;
  role: string;
}

/** Ensure the user is a member of the group; returns their membership row. */
export async function requireMembership(
  groupId: string,
  userId: string
): Promise<MembershipContext> {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member) {
    // Don't leak existence — treat as not found for non-members.
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw Errors.notFound("Group not found");
    throw Errors.forbidden("You are not a member of this group");
  }
  return { groupId, userId, role: member.role };
}

/** Ensure the user is an admin of the group. */
export async function requireAdmin(
  groupId: string,
  userId: string
): Promise<MembershipContext> {
  const ctx = await requireMembership(groupId, userId);
  if (ctx.role !== "admin") {
    throw Errors.forbidden("Only a group admin can perform this action");
  }
  return ctx;
}
