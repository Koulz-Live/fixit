import { createClient } from "../lib/supabase/server";

export const ROLES = ["tenant_user", "tier_1_admin", "tier_2_admin", "tier_3_admin", "manager", "executive", "auditor", "super_admin"] as const;
export type AccessRole = typeof ROLES[number];

export async function ensureAccessProfile(user: { userId: string; email: string; displayName: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_access_profile", { p_display_name: user.displayName });
  if (error) throw error; return String(data);
}

export async function getAccessWorkspace(userId: string, tenantId: string) {
  const supabase = await createClient();
  const { data: viewer, error: viewerError } = await supabase.from("memberships").select("role, tenant:tenants!inner(id,name,status)").eq("user_id", userId).eq("tenant_id", tenantId).single();
  if (viewerError || !viewer) throw viewerError ?? new Error("Membership not found");
  const { data: memberships, error: memberError } = await supabase.from("memberships").select("role,user:profiles!inner(user_id,display_name,status,last_seen_at,email)").eq("tenant_id", tenantId);
  if (memberError) throw memberError;
  const { data: audit, error: auditError } = await supabase.from("access_audit_events").select("id,action,from_role,to_role,created_at,actor:profiles!access_audit_events_actor_user_id_fkey(display_name),target:profiles!access_audit_events_target_user_id_fkey(display_name)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(8);
  if (auditError) throw auditError;
  const tenant = Array.isArray(viewer.tenant) ? viewer.tenant[0] : viewer.tenant;
  return { viewer: { role: viewer.role, tenantId: tenant.id, tenantName: tenant.name, tenantStatus: tenant.status }, members: (memberships ?? []).map((m: any) => ({ id: m.user.user_id, email: m.user.email, displayName: m.user.display_name, status: m.user.status, role: m.role, lastSeenAt: Math.floor(new Date(m.user.last_seen_at).getTime()/1000) })), audit: (audit ?? []).map((a: any) => ({ id:a.id, action:a.action, fromRole:a.from_role, toRole:a.to_role, createdAt:Math.floor(new Date(a.created_at).getTime()/1000), actorName:a.actor?.display_name, targetName:a.target?.display_name })) };
}

export async function changeMemberRole(_actorId: string, targetId: string, tenantId: string, role: AccessRole) {
  const supabase = await createClient(); const { error } = await supabase.rpc("change_platform_role", { p_tenant_id: tenantId, p_target_user_id: targetId, p_role: role }); if (error) throw new Error(error.message);
}
