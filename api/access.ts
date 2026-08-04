import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireIdentity, statusFor } from "./_supabase.js";

const roles = ["tenant_user", "tier_1_admin", "tier_2_admin", "tier_3_admin", "manager", "executive", "auditor", "super_admin"] as const;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const identity = await requireIdentity(request);
    if (request.method === "PATCH") {
      const { tenantId, targetUserId, role } = request.body ?? {};
      if (!tenantId || !targetUserId || !roles.includes(role)) return response.status(400).json({ error: "Invalid role change request" });
      const { error } = await identity.supabase.rpc("change_platform_role", { p_tenant_id: tenantId, p_target_user_id: targetUserId, p_role: role });
      if (error) throw new Error(error.message);
      return response.json({ ok: true });
    }
    if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed" });
    const { data: tenantId, error: profileError } = await identity.supabase.rpc("ensure_access_profile", { p_display_name: identity.displayName });
    if (profileError) throw profileError;
    const { data: viewer, error: viewerError } = await identity.supabase.from("memberships").select("role, tenant:tenants!inner(id,name,status)").eq("user_id", identity.userId).eq("tenant_id", tenantId).single();
    if (viewerError || !viewer) throw viewerError ?? new Error("Membership not found");
    const { data: memberships, error: memberError } = await identity.supabase.from("memberships").select("role,user:profiles!inner(user_id,display_name,status,last_seen_at,email)").eq("tenant_id", tenantId);
    if (memberError) throw memberError;
    const { data: audit, error: auditError } = await identity.supabase.from("access_audit_events").select("id,action,from_role,to_role,created_at,actor:profiles!access_audit_events_actor_user_id_fkey(display_name),target:profiles!access_audit_events_target_user_id_fkey(display_name)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(8);
    if (auditError) throw auditError;
    const tenant = Array.isArray(viewer.tenant) ? viewer.tenant[0] : viewer.tenant;
    return response.json({ viewer: { role: viewer.role, tenantId: tenant.id, tenantName: tenant.name, tenantStatus: tenant.status }, members: (memberships ?? []).map((entry: any) => { const user = Array.isArray(entry.user) ? entry.user[0] : entry.user; return { id: user.user_id, email: user.email, displayName: user.display_name, status: user.status, role: entry.role, lastSeenAt: Math.floor(new Date(user.last_seen_at).getTime() / 1000) }; }), audit: (audit ?? []).map((entry: any) => { const actor = Array.isArray(entry.actor) ? entry.actor[0] : entry.actor; const target = Array.isArray(entry.target) ? entry.target[0] : entry.target; return { id: entry.id, action: entry.action, fromRole: entry.from_role, toRole: entry.to_role, createdAt: Math.floor(new Date(entry.created_at).getTime() / 1000), actorName: actor?.display_name, targetName: target?.display_name }; }) });
  } catch (error) {
    const failure = statusFor(error); return response.status(failure.status).json({ error: failure.message });
  }
}
