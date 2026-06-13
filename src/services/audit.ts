import { prisma } from "../db";

/** Best-effort audit log write. Never throws into the request path. */
export async function audit(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: (params.metadata ?? undefined) as any,
      },
    });
  } catch {
    // swallow — auditing must not break the operation
  }
}
