import { env } from "cloudflare:workers";
import { ensureAccessProfile } from "./access";

type Identity = { userId: string; email: string; displayName: string };

function db() { if (!env.DB) throw new Error("D1 binding DB is unavailable"); return env.DB; }
function safeId(value: string) { return value.replace(/[^a-zA-Z0-9]/g, "").slice(-20) || "member"; }

export async function ensureMarketplaceContext(user: Identity) {
  await ensureAccessProfile(user);
  const database = db();
  const now = Math.floor(Date.now() / 1000);
  const suffix = safeId(user.userId);
  const clientTenantId = `client_${suffix}`;
  const artisanTenantId = `artisan_${suffix}`;
  await database.batch([
    database.prepare("INSERT OR IGNORE INTO tenants (id, name, slug, status, tenant_type, country_code, created_by, created_at) VALUES (?, ?, ?, 'active', 'client_individual', 'ZA', ?, ?)").bind(clientTenantId, `${user.displayName} Household`, `client-${suffix.toLowerCase()}`, user.userId, now),
    database.prepare("INSERT OR IGNORE INTO tenants (id, name, slug, status, tenant_type, country_code, created_by, created_at) VALUES (?, ?, ?, 'active', 'artisan_individual', 'ZA', ?, ?)").bind(artisanTenantId, `${user.displayName} Artisan Services`, `artisan-${suffix.toLowerCase()}`, user.userId, now),
    database.prepare("INSERT OR IGNORE INTO tenant_role_assignments (id, tenant_id, user_id, role_code, granted_by, granted_at) VALUES (?, ?, ?, 'user_client', ?, ?)").bind(`${clientTenantId}:${user.userId}:client`, clientTenantId, user.userId, user.userId, now),
    database.prepare("INSERT OR IGNORE INTO tenant_role_assignments (id, tenant_id, user_id, role_code, granted_by, granted_at) VALUES (?, ?, ?, 'user_artisan', ?, ?)").bind(`${artisanTenantId}:${user.userId}:artisan`, artisanTenantId, user.userId, user.userId, now),
    database.prepare("INSERT OR IGNORE INTO client_profiles (tenant_id, client_type, preferred_contact_method, profile_status, created_at, updated_at) VALUES (?, 'individual', 'in_app', 'active', ?, ?)").bind(clientTenantId, now, now),
    database.prepare("INSERT OR IGNORE INTO artisan_profiles (tenant_id, public_slug, trading_name, biography, years_experience, base_hourly_rate_minor, currency_code, callout_fee_minor, pricing_model, availability_status, verification_status, profile_status, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 45000, 'ZAR', 25000, 'hourly', 'available', 'pending', 'draft', ?, ?)").bind(artisanTenantId, `artisan-${suffix.toLowerCase()}`, `${user.displayName} Artisan Services`, "Local artisan services with governed quotations, job evidence and transparent pricing.", now, now),
    database.prepare("INSERT OR IGNORE INTO disciplines (id, code, name, is_active) VALUES ('disc_plumbing', 'plumbing', 'Plumbing', 1)"),
    database.prepare("INSERT OR IGNORE INTO disciplines (id, code, name, is_active) VALUES ('disc_electrical', 'electrical', 'Electrical', 1)"),
    database.prepare("INSERT OR IGNORE INTO disciplines (id, code, name, is_active) VALUES ('disc_carpentry', 'carpentry', 'Carpentry', 1)"),
    database.prepare("INSERT OR IGNORE INTO disciplines (id, code, name, is_active) VALUES ('disc_painting', 'painting', 'Painting', 1)"),
  ]);
  return { clientTenantId, artisanTenantId };
}

export async function getMarketplaceWorkspace(user: Identity) {
  const context = await ensureMarketplaceContext(user);
  const database = db();
  const assignments = await database.prepare("SELECT r.tenant_id AS tenantId, r.role_code AS roleCode, t.name AS tenantName, t.tenant_type AS tenantType FROM tenant_role_assignments r JOIN tenants t ON t.id = r.tenant_id WHERE r.user_id = ? AND r.revoked_at IS NULL ORDER BY r.role_code").bind(user.userId).all();
  const requests = await database.prepare("SELECT sr.id, sr.title, sr.description, sr.area_label AS areaLabel, sr.status, sr.budget_min_minor AS budgetMinMinor, sr.budget_max_minor AS budgetMaxMinor, sr.currency_code AS currencyCode, d.name AS discipline, sr.created_at AS createdAt FROM service_requests sr JOIN disciplines d ON d.id = sr.discipline_id WHERE sr.client_tenant_id = ? ORDER BY sr.created_at DESC").bind(context.clientTenantId).all();
  return { context, assignments: assignments.results, requests: requests.results, featureFlags: { tenantSubroles: true, artisanProfiles: true, artisanDiscovery: true, serviceRequests: true, quotes: true, jobManagement: true, artisanFinance: true, verifiedReviews: true, paymentProvider: false, geospatialSearch: false } };
}

export async function createServiceRequest(user: Identity, input: { title: string; description: string; discipline: string; areaLabel: string; budgetMinMinor: number; budgetMaxMinor: number }) {
  const context = await ensureMarketplaceContext(user);
  const database = db();
  const assignment = await database.prepare("SELECT 1 AS allowed FROM tenant_role_assignments WHERE tenant_id = ? AND user_id = ? AND role_code = 'user_client' AND revoked_at IS NULL").bind(context.clientTenantId, user.userId).first();
  if (!assignment) throw new Error("FORBIDDEN");
  const discipline = await database.prepare("SELECT id FROM disciplines WHERE code = ? AND is_active = 1").bind(input.discipline).first<{ id: string }>();
  if (!discipline) throw new Error("INVALID_DISCIPLINE");
  const now = Math.floor(Date.now() / 1000); const id = crypto.randomUUID(); const correlationId = crypto.randomUUID();
  await database.batch([
    database.prepare("INSERT INTO service_requests (id, client_tenant_id, discipline_id, title, description, area_label, budget_min_minor, budget_max_minor, currency_code, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ZAR', 'published', ?, ?, ?)").bind(id, context.clientTenantId, discipline.id, input.title, input.description, input.areaLabel, input.budgetMinMinor, input.budgetMaxMinor, user.userId, now, now),
    database.prepare("INSERT INTO marketplace_audit_events (id, actor_user_id, actor_tenant_id, active_role, correlation_id, action, resource_type, resource_id, outcome, occurred_at) VALUES (?, ?, ?, 'user_client', ?, 'service_request.published', 'service_request', ?, 'success', ?)").bind(crypto.randomUUID(), user.userId, context.clientTenantId, correlationId, id, now),
  ]);
  return { id, correlationId };
}
