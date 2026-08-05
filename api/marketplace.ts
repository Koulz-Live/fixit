import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireIdentity, statusFor } from "./_supabase.js";
import { enforceRequestPolicy, recordSecurityEvent } from "./_security.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const policy = enforceRequestPolicy(request, response, request.method === "POST" ? 30 : 120); if (!policy.allowed) return;
  try {
    const identity = await requireIdentity(request);
    if (request.method === "POST") {
      const body = request.body ?? {}; const title = String(body.title ?? "").trim(); const description = String(body.description ?? "").trim(); const discipline = String(body.discipline ?? ""); const areaLabel = String(body.areaLabel ?? "").trim(); const budgetMinMinor = Math.round(Number(body.budgetMin ?? 0) * 100); const budgetMaxMinor = Math.round(Number(body.budgetMax ?? 0) * 100);
      if (title.length < 5 || description.length < 10 || !areaLabel || budgetMinMinor < 0 || budgetMaxMinor < budgetMinMinor) return response.status(400).json({ error: "Please provide a valid title, description, area and budget range." });
      const { data, error } = await identity.supabase.rpc("create_service_request", { p_title: title, p_description: description, p_discipline_code: discipline, p_area_label: areaLabel, p_budget_min_minor: budgetMinMinor, p_budget_max_minor: budgetMaxMinor });
      if (error) { await recordSecurityEvent(identity,{...policy,category:"marketplace",action:"service_request.create",severity:"medium",outcome:"failure",reasonCode:error.message}); throw new Error(error.message); }
      await recordSecurityEvent(identity,{...policy,category:"marketplace",action:"service_request.create",outcome:"success",resourceType:"service_request",resourceId:String(data?.id??"")});
      return response.status(201).json({...data,correlationId:policy.correlationId});
    }
    if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed" });
    const { error: profileError } = await identity.supabase.rpc("ensure_access_profile", { p_display_name: identity.displayName }); if (profileError) throw profileError;
    const { data: context, error: contextError } = await identity.supabase.rpc("ensure_marketplace_context", { p_display_name: identity.displayName }); if (contextError) throw contextError;
    const { data: assignments, error: roleError } = await identity.supabase.from("tenant_role_assignments").select("tenant_id,role_code,tenant:tenants!inner(name,tenant_type)").eq("user_id", identity.userId).is("revoked_at", null); if (roleError) throw roleError;
    const { data: requests, error: requestError } = await identity.supabase.from("service_requests").select("id,title,description,area_label,status,budget_min_minor,budget_max_minor,currency_code,created_at,discipline:disciplines!inner(name)").eq("client_tenant_id", context.clientTenantId).order("created_at", { ascending: false }); if (requestError) throw requestError;
    return response.json({ context, assignments: (assignments ?? []).map((entry: any) => { const tenant = Array.isArray(entry.tenant) ? entry.tenant[0] : entry.tenant; return { tenantId: entry.tenant_id, roleCode: entry.role_code, tenantName: tenant?.name, tenantType: tenant?.tenant_type }; }), requests: (requests ?? []).map((entry: any) => { const discipline = Array.isArray(entry.discipline) ? entry.discipline[0] : entry.discipline; return { id: entry.id, title: entry.title, description: entry.description, areaLabel: entry.area_label, status: entry.status, budgetMinMinor: entry.budget_min_minor, budgetMaxMinor: entry.budget_max_minor, currencyCode: entry.currency_code, discipline: discipline?.name, createdAt: Math.floor(new Date(entry.created_at).getTime() / 1000) }; }), featureFlags: { tenantSubroles: true, artisanProfiles: true, artisanDiscovery: true, serviceRequests: true, quotes: true, jobManagement: true, artisanFinance: true, verifiedReviews: true, paymentProvider: false, geospatialSearch: false } });
  } catch (error) {
    const failure = statusFor(error); return response.status(failure.status).json({ error: failure.message });
  }
}
