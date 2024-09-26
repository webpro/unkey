import { insertAuditLogs } from "@/lib/audit";
import { type Permission, db, schema } from "@/lib/db";
import { ingestAuditLogsTinybird } from "@/lib/tinybird";
import { TRPCError } from "@trpc/server";
import { newId } from "@unkey/id";
import type { Context } from "../../context";

export async function upsertPermission(
  ctx: Context,
  workspaceId: string,
  name: string,
): Promise<Permission> {
  return await db.transaction(async (tx) => {
    const existingPermission = await tx.query.permissions
      .findFirst({
        where: (table, { and, eq }) =>
          and(eq(table.workspaceId, workspaceId), eq(table.name, name)),
      })
      .catch((_err) => {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "We are unable to upsert the permission. Please contact support using support@unkey.dev",
        });
      });
    if (existingPermission) {
      return existingPermission;
    }

    const permission: Permission = {
      id: newId("permission"),
      workspaceId,
      name,
      description: null,
      createdAt: new Date(),
      updatedAt: null,
    };

    await tx
      .insert(schema.permissions)
      .values(permission)
      .catch((_err) => {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "We are unable to upsert the permission. Please contact support using support@unkey.dev.",
        });
      });
    await insertAuditLogs(tx, {
      workspaceId,
      actor: { type: "user", id: ctx.user!.id },
      event: "permission.create",
      description: `Created ${permission.id}`,
      resources: [
        {
          type: "permission",
          id: permission.id,
        },
      ],
      context: {
        location: ctx.audit.location,
        userAgent: ctx.audit.userAgent,
      },
    });
    await ingestAuditLogsTinybird({
      workspaceId,
      actor: { type: "user", id: ctx.user!.id },
      event: "permission.create",
      description: `Created ${permission.id}`,
      resources: [
        {
          type: "permission",
          id: permission.id,
        },
      ],
      context: {
        location: ctx.audit.location,
        userAgent: ctx.audit.userAgent,
      },
    });
    return permission;
  });
}
