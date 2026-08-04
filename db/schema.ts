import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
  tenantType: text("tenant_type", { enum: ["client_individual", "client_organization", "artisan_individual", "artisan_business", "platform_internal"] }).notNull().default("platform_internal"),
  countryCode: text("country_code").notNull().default("ZA"),
  createdBy: text("created_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const tenantRoleAssignments = sqliteTable("tenant_role_assignments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull().references(() => users.id),
  roleCode: text("role_code", { enum: ["user_client", "user_artisan"] }).notNull(),
  grantedBy: text("granted_by").notNull(),
  grantedAt: integer("granted_at", { mode: "timestamp" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
}, (table) => [uniqueIndex("idx_tenant_role_active").on(table.tenantId, table.userId, table.roleCode)]);

export const clientProfiles = sqliteTable("client_profiles", {
  tenantId: text("tenant_id").primaryKey().references(() => tenants.id),
  clientType: text("client_type").notNull(),
  preferredContactMethod: text("preferred_contact_method").notNull().default("in_app"),
  profileStatus: text("profile_status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const artisanProfiles = sqliteTable("artisan_profiles", {
  tenantId: text("tenant_id").primaryKey().references(() => tenants.id),
  publicSlug: text("public_slug").notNull().unique(),
  tradingName: text("trading_name").notNull(),
  biography: text("biography").notNull(),
  yearsExperience: integer("years_experience").notNull().default(0),
  baseHourlyRateMinor: integer("base_hourly_rate_minor").notNull().default(0),
  currencyCode: text("currency_code").notNull().default("ZAR"),
  calloutFeeMinor: integer("callout_fee_minor"),
  pricingModel: text("pricing_model").notNull().default("hourly"),
  availabilityStatus: text("availability_status").notNull().default("available"),
  verificationStatus: text("verification_status").notNull().default("pending"),
  profileStatus: text("profile_status").notNull().default("draft"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const disciplines = sqliteTable("disciplines", {
  id: text("id").primaryKey(), code: text("code").notNull().unique(), name: text("name").notNull(), isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const artisanDisciplines = sqliteTable("artisan_disciplines", {
  id: text("id").primaryKey(), artisanTenantId: text("artisan_tenant_id").notNull().references(() => tenants.id), disciplineId: text("discipline_id").notNull().references(() => disciplines.id), isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false), yearsExperience: integer("years_experience"),
}, (table) => [uniqueIndex("idx_artisan_discipline").on(table.artisanTenantId, table.disciplineId)]);

export const artisanServiceAreas = sqliteTable("artisan_service_areas", {
  id: text("id").primaryKey(), artisanTenantId: text("artisan_tenant_id").notNull().references(() => tenants.id), countryCode: text("country_code").notNull(), provinceRegion: text("province_region").notNull(), municipalityCity: text("municipality_city").notNull(), locality: text("locality"), publicLabel: text("public_label").notNull(),
});

export const serviceRequests = sqliteTable("service_requests", {
  id: text("id").primaryKey(), clientTenantId: text("client_tenant_id").notNull().references(() => tenants.id), disciplineId: text("discipline_id").notNull().references(() => disciplines.id), title: text("title").notNull(), description: text("description").notNull(), areaLabel: text("area_label").notNull(), budgetMinMinor: integer("budget_min_minor"), budgetMaxMinor: integer("budget_max_minor"), currencyCode: text("currency_code").notNull().default("ZAR"), status: text("status").notNull().default("draft"), createdBy: text("created_by").notNull(), createdAt: integer("created_at", { mode: "timestamp" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [uniqueIndex("idx_request_tenant_id").on(table.clientTenantId, table.id)]);

export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(), serviceRequestId: text("service_request_id").references(() => serviceRequests.id), clientTenantId: text("client_tenant_id").notNull().references(() => tenants.id), artisanTenantId: text("artisan_tenant_id").notNull().references(() => tenants.id), quoteNumber: text("quote_number").notNull(), versionNumber: integer("version_number").notNull().default(1), status: text("status").notNull().default("draft"), currencyCode: text("currency_code").notNull().default("ZAR"), subtotalMinor: integer("subtotal_minor").notNull(), taxMinor: integer("tax_minor").notNull().default(0), totalMinor: integer("total_minor").notNull(), validUntil: integer("valid_until", { mode: "timestamp" }), createdBy: text("created_by").notNull(), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(), acceptedQuoteId: text("accepted_quote_id").references(() => quotes.id), clientTenantId: text("client_tenant_id").notNull().references(() => tenants.id), artisanTenantId: text("artisan_tenant_id").notNull().references(() => tenants.id), jobNumber: text("job_number").notNull().unique(), title: text("title").notNull(), scopeBaseline: text("scope_baseline").notNull(), areaLabel: text("area_label").notNull(), status: text("status").notNull().default("proposed"), plannedStartAt: integer("planned_start_at", { mode: "timestamp" }), plannedEndAt: integer("planned_end_at", { mode: "timestamp" }), createdBy: text("created_by").notNull(), createdAt: integer("created_at", { mode: "timestamp" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(), jobId: text("job_id").notNull().references(() => jobs.id), clientTenantId: text("client_tenant_id").notNull().references(() => tenants.id), artisanTenantId: text("artisan_tenant_id").notNull().references(() => tenants.id), invoiceNumber: text("invoice_number").notNull().unique(), status: text("status").notNull().default("draft"), currencyCode: text("currency_code").notNull().default("ZAR"), totalMinor: integer("total_minor").notNull(), amountPaidMinor: integer("amount_paid_minor").notNull().default(0), amountDueMinor: integer("amount_due_minor").notNull(), dueAt: integer("due_at", { mode: "timestamp" }), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const artisanReviews = sqliteTable("artisan_reviews", {
  id: text("id").primaryKey(), jobId: text("job_id").notNull().unique().references(() => jobs.id), clientTenantId: text("client_tenant_id").notNull().references(() => tenants.id), artisanTenantId: text("artisan_tenant_id").notNull().references(() => tenants.id), ratingOverall: integer("rating_overall").notNull(), reviewText: text("review_text"), moderationStatus: text("moderation_status").notNull().default("published"), createdBy: text("created_by").notNull(), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const marketplaceAuditEvents = sqliteTable("marketplace_audit_events", {
  id: text("id").primaryKey(), actorUserId: text("actor_user_id").notNull(), actorTenantId: text("actor_tenant_id").notNull(), activeRole: text("active_role").notNull(), correlationId: text("correlation_id").notNull(), action: text("action").notNull(), resourceType: text("resource_type").notNull(), resourceId: text("resource_id").notNull(), outcome: text("outcome").notNull(), reasonCode: text("reason_code"), occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status", { enum: ["active", "invited", "suspended"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
});

export const memberships = sqliteTable("memberships", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role", { enum: ["tenant_user", "tier_1_admin", "tier_2_admin", "tier_3_admin", "manager", "executive", "auditor", "super_admin"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  uniqueIndex("idx_memberships_tenant_user").on(table.tenantId, table.userId),
]);

export const accessAuditEvents = sqliteTable("access_audit_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  actorUserId: text("actor_user_id").notNull().references(() => users.id),
  targetUserId: text("target_user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  fromRole: text("from_role"),
  toRole: text("to_role"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
