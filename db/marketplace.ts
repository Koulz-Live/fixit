import { createClient } from "../lib/supabase/server";
import { ensureAccessProfile } from "./access";

type Identity = { userId: string; email: string; displayName: string };

export async function ensureMarketplaceContext(user: Identity) {
  await ensureAccessProfile(user); const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_marketplace_context", { p_display_name: user.displayName }); if (error) throw error;
  return data as { clientTenantId: string; artisanTenantId: string };
}

export async function getMarketplaceWorkspace(user: Identity) {
  const context = await ensureMarketplaceContext(user); const supabase = await createClient();
  const { data: assignments, error: roleError } = await supabase.from("tenant_role_assignments").select("tenant_id,role_code,tenant:tenants!inner(name,tenant_type)").eq("user_id", user.userId).is("revoked_at", null); if (roleError) throw roleError;
  const { data: requests, error: requestError } = await supabase.from("service_requests").select("id,title,description,area_label,status,budget_min_minor,budget_max_minor,currency_code,created_at,discipline:disciplines!inner(name)").eq("client_tenant_id", context.clientTenantId).order("created_at", { ascending:false }); if (requestError) throw requestError;
  return { context, assignments: (assignments ?? []).map((a:any)=>({tenantId:a.tenant_id,roleCode:a.role_code,tenantName:a.tenant?.name,tenantType:a.tenant?.tenant_type})), requests:(requests??[]).map((r:any)=>({id:r.id,title:r.title,description:r.description,areaLabel:r.area_label,status:r.status,budgetMinMinor:r.budget_min_minor,budgetMaxMinor:r.budget_max_minor,currencyCode:r.currency_code,discipline:r.discipline?.name,createdAt:Math.floor(new Date(r.created_at).getTime()/1000)})), featureFlags:{tenantSubroles:true,artisanProfiles:true,artisanDiscovery:true,serviceRequests:true,quotes:true,jobManagement:true,artisanFinance:true,verifiedReviews:true,paymentProvider:false,geospatialSearch:false} };
}

export async function createServiceRequest(user: Identity, input: { title:string;description:string;discipline:string;areaLabel:string;budgetMinMinor:number;budgetMaxMinor:number }) {
  const supabase = await createClient(); const { data,error } = await supabase.rpc("create_service_request", { p_title:input.title,p_description:input.description,p_discipline_code:input.discipline,p_area_label:input.areaLabel,p_budget_min_minor:input.budgetMinMinor,p_budget_max_minor:input.budgetMaxMinor }); if(error) throw new Error(error.message); return data;
}
