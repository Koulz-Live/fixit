import { env } from "cloudflare:workers";

export const ROLES = ["tenant_user", "tier_1_admin", "tier_2_admin", "tier_3_admin", "manager", "executive", "auditor", "super_admin"] as const;
export type AccessRole = typeof ROLES[number];

export type AccessMember = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  role: AccessRole;
  lastSeenAt: number;
};

function database() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export async function ensureAccessProfile(user: { userId: string; email: string; displayName: string }) {
  const db = database();
  const now = Math.floor(Date.now() / 1000);
  const tenantId = "tenant_enterprise_architecture";
  const membershipId = `${tenantId}:${user.userId}`;
  const count = await db.prepare("SELECT COUNT(*) AS count FROM memberships").first<{ count: number }>();
  const firstRole: AccessRole = Number(count?.count ?? 0) === 0 ? "super_admin" : "tenant_user";
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO tenants (id, name, slug, status, created_at) VALUES (?, ?, ?, 'active', ?)").bind(tenantId, "Enterprise Architecture Office", "enterprise-architecture-office", now),
    db.prepare("INSERT INTO users (id, email, display_name, status, created_at, last_seen_at) VALUES (?, ?, ?, 'active', ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, last_seen_at = excluded.last_seen_at").bind(user.userId, user.email, user.displayName, now, now),
    db.prepare("INSERT OR IGNORE INTO memberships (id, tenant_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(membershipId, tenantId, user.userId, firstRole, now, now),
  ]);
  return tenantId;
}

export async function getAccessWorkspace(userId: string, tenantId: string) {
  const db = database();
  const viewer = await db.prepare("SELECT m.role, t.id AS tenantId, t.name AS tenantName, t.status AS tenantStatus FROM memberships m JOIN tenants t ON t.id = m.tenant_id WHERE m.user_id = ? AND m.tenant_id = ?").bind(userId, tenantId).first<{ role: AccessRole; tenantId: string; tenantName: string; tenantStatus: string }>();
  if (!viewer) throw new Error("Membership not found");
  const members = await db.prepare("SELECT u.id, u.email, u.display_name AS displayName, u.status, m.role, u.last_seen_at AS lastSeenAt FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ? ORDER BY CASE m.role WHEN 'super_admin' THEN 1 WHEN 'executive' THEN 2 WHEN 'manager' THEN 3 ELSE 4 END, u.display_name").bind(tenantId).all<AccessMember>();
  const audit = await db.prepare("SELECT a.id, a.action, a.from_role AS fromRole, a.to_role AS toRole, a.created_at AS createdAt, actor.display_name AS actorName, target.display_name AS targetName FROM access_audit_events a JOIN users actor ON actor.id = a.actor_user_id JOIN users target ON target.id = a.target_user_id WHERE a.tenant_id = ? ORDER BY a.created_at DESC LIMIT 8").bind(tenantId).all();
  return { viewer, members: members.results, audit: audit.results };
}

export async function changeMemberRole(actorId: string, targetId: string, tenantId: string, role: AccessRole) {
  const db = database();
  const actor = await db.prepare("SELECT role FROM memberships WHERE tenant_id = ? AND user_id = ?").bind(tenantId, actorId).first<{ role: AccessRole }>();
  if (actor?.role !== "super_admin") throw new Error("FORBIDDEN");
  const target = await db.prepare("SELECT role FROM memberships WHERE tenant_id = ? AND user_id = ?").bind(tenantId, targetId).first<{ role: AccessRole }>();
  if (!target) throw new Error("MEMBER_NOT_FOUND");
  if (targetId === actorId && role !== "super_admin") throw new Error("SELF_DEMOTION_BLOCKED");
  const now = Math.floor(Date.now() / 1000);
  await db.batch([
    db.prepare("UPDATE memberships SET role = ?, updated_at = ? WHERE tenant_id = ? AND user_id = ?").bind(role, now, tenantId, targetId),
    db.prepare("INSERT INTO access_audit_events (id, tenant_id, actor_user_id, target_user_id, action, from_role, to_role, created_at) VALUES (?, ?, ?, ?, 'role.changed', ?, ?, ?)").bind(crypto.randomUUID(), tenantId, actorId, targetId, target.role, role, now),
  ]);
}
