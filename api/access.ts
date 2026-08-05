import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireIdentity, statusFor } from "./_supabase.js";
import { enforceRequestPolicy, recordSecurityEvent } from "./_security.js";

const roles = ["tenant_user", "tier_1_admin", "tier_2_admin", "tier_3_admin", "manager", "executive", "auditor", "super_admin"] as const;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const policy = enforceRequestPolicy(request, response, request.method === "PATCH" ? 30 : 120); if (!policy.allowed) return;
  try {
    const identity = await requireIdentity(request);
    if (request.method === "PATCH") {
      const { tenantId, targetUserId, role } = request.body ?? {};
      if (!tenantId || !targetUserId || !roles.includes(role)) return response.status(400).json({ error: "Invalid role change request", correlationId: policy.correlationId });
      const { error } = await identity.supabase.rpc("change_platform_role", { p_tenant_id: tenantId, p_target_user_id: targetUserId, p_role: role });
      if (error) { await recordSecurityEvent(identity,{...policy,category:"authorization",action:"platform_admin_role.change",severity:"high",outcome:"denied",tenantId,resourceType:"profile",resourceId:targetUserId,reasonCode:error.message}); throw new Error(error.message); }
      return response.json({ ok: true, correlationId: policy.correlationId });
    }
    if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed", correlationId: policy.correlationId });
    const { data: tenantId, error: profileError } = await identity.supabase.rpc("ensure_access_profile", { p_display_name: identity.displayName }); if (profileError) throw profileError;
    const [{ data: viewer, error: viewerError },{ data: memberships, error: memberError },{ data: assignments, error: assignmentError },{ data: audit, error: auditError },{ data: permissions }] = await Promise.all([
      identity.supabase.from("memberships").select("role, tenant:tenants!inner(id,name,status)").eq("user_id",identity.userId).eq("tenant_id",tenantId).single(),
      identity.supabase.from("memberships").select("role,user:profiles!inner(user_id,display_name,status,last_seen_at,email)").eq("tenant_id",tenantId),
      identity.supabase.from("platform_admin_assignments").select("user_id,role,status,expires_at").eq("status","active").is("revoked_at",null),
      identity.supabase.from("access_audit_events").select("id,action,from_role,to_role,created_at,actor:profiles!access_audit_events_actor_user_id_fkey(display_name),target:profiles!access_audit_events_target_user_id_fkey(display_name)").eq("tenant_id",tenantId).order("created_at",{ascending:false}).limit(20),
      identity.supabase.from("role_permissions").select("role,permission")
    ]);
    if (viewerError || !viewer) throw viewerError ?? new Error("Membership not found"); if (memberError) throw memberError; if (assignmentError) throw assignmentError; if (auditError) throw auditError;
    const tenant=Array.isArray(viewer.tenant)?viewer.tenant[0]:viewer.tenant; const assignmentMap=new Map((assignments??[]).map((a:any)=>[a.user_id,a])); const viewerAssignment=assignmentMap.get(identity.userId) as any;
    return response.json({ viewer:{tenantRole:"tenant_user",platformRole:viewerAssignment?.role??null,tenantId:tenant.id,tenantName:tenant.name,tenantStatus:tenant.status,permissions:(permissions??[]).filter((p:any)=>p.role===viewerAssignment?.role).map((p:any)=>p.permission)}, members:(memberships??[]).map((entry:any)=>{const user=Array.isArray(entry.user)?entry.user[0]:entry.user;const admin=assignmentMap.get(user.user_id) as any;return{id:user.user_id,email:user.email,displayName:user.display_name,status:user.status,tenantRole:"tenant_user",platformRole:admin?.role??null,adminStatus:admin?.status??null,lastSeenAt:Math.floor(new Date(user.last_seen_at).getTime()/1000)}}), audit:(audit??[]).map((entry:any)=>{const actor=Array.isArray(entry.actor)?entry.actor[0]:entry.actor;const target=Array.isArray(entry.target)?entry.target[0]:entry.target;return{id:entry.id,action:entry.action,fromRole:entry.from_role,toRole:entry.to_role,createdAt:Math.floor(new Date(entry.created_at).getTime()/1000),actorName:actor?.display_name,targetName:target?.display_name}}), correlationId:policy.correlationId });
  } catch(error) { const failure=statusFor(error); return response.status(failure.status).json({error:failure.message,correlationId:policy.correlationId}); }
}
