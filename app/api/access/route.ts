import { getChatGPTUser } from "../../chatgpt-auth";
import { changeMemberRole, ensureAccessProfile, getAccessWorkspace, ROLES, type AccessRole } from "../../../db/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    const tenantId = await ensureAccessProfile(user);
    return Response.json(await getAccessWorkspace(user.userId, tenantId));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load access workspace" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json() as { tenantId?: string; targetUserId?: string; role?: string };
  if (!body.tenantId || !body.targetUserId || !ROLES.includes(body.role as AccessRole)) {
    return Response.json({ error: "Invalid role change request" }, { status: 400 });
  }
  try {
    await changeMemberRole(user.userId, body.targetUserId, body.tenantId, body.role as AccessRole);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Role change failed";
    return Response.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 409 });
  }
}
