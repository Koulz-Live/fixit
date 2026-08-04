"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

type RoleKey = "tenant_user" | "tier_1_admin" | "tier_2_admin" | "tier_3_admin" | "manager" | "executive" | "auditor" | "super_admin";
type Member = { id: string; email: string; displayName: string; status: string; role: RoleKey; lastSeenAt: number };
type Workspace = { viewer: { role: RoleKey; tenantId: string; tenantName: string; tenantStatus: string }; members: Member[]; audit: Array<{ id: string; action: string; fromRole: string; toRole: string; createdAt: number; actorName: string; targetName: string }> };

const roles: Array<{ key: RoleKey; label: string; tier: string; scope: string; permissions: string[]; tone: string }> = [
  { key: "tenant_user", label: "Tenant User", tier: "Tenant", scope: "Own tenant workspace", permissions: ["View assigned architecture", "Submit evidence", "Track own work"], tone: "#e85d3f" },
  { key: "tier_1_admin", label: "Tier 1 Admin", tier: "Tier 1", scope: "Front-line operations", permissions: ["User support", "Basic record updates", "Escalate incidents"], tone: "#e7b252" },
  { key: "tier_2_admin", label: "Tier 2 Admin", tier: "Tier 2", scope: "Technical operations", permissions: ["Resolve escalations", "Manage integrations", "Review telemetry"], tone: "#74a789" },
  { key: "tier_3_admin", label: "Tier 3 Admin", tier: "Tier 3", scope: "Platform operations", permissions: ["Advanced diagnostics", "Control configuration", "Recovery operations"], tone: "#5c91ac" },
  { key: "manager", label: "Manager", tier: "Management", scope: "Tenant team & delivery", permissions: ["Assign work", "Approve operational changes", "View team performance"], tone: "#8f7ab8" },
  { key: "executive", label: "Executive", tier: "Executive", scope: "Enterprise oversight", permissions: ["Portfolio visibility", "Risk acceptance", "Strategic decisions"], tone: "#c26f69" },
  { key: "auditor", label: "Auditor", tier: "Independent", scope: "Read-only assurance", permissions: ["Inspect evidence", "Review audit trail", "Export assurance reports"], tone: "#6f7874" },
  { key: "super_admin", label: "Super Admin", tier: "Platform", scope: "All tenants & controls", permissions: ["Manage tenants", "Assign all roles", "Configure platform policy"], tone: "#17221e" },
];

const labels = Object.fromEntries(roles.map((role) => [role.key, role.label])) as Record<RoleKey, string>;

export default function AccessConsole({ user, signOutPath }: { user: { id: string; name: string; email: string }; signOutPath: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [section, setSection] = useState<"directory" | "roles" | "audit">("directory");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await axios.get("/api/access", { headers: { "Cache-Control": "no-store" } });
    setWorkspace(data);
  }, []);

  useEffect(() => { load().catch((error) => setMessage(error.message)); }, [load]);
  const members = useMemo(() => (workspace?.members ?? []).filter((member) => `${member.displayName} ${member.email} ${labels[member.role]}`.toLowerCase().includes(query.toLowerCase())), [workspace, query]);

  async function updateRole(targetUserId: string, role: RoleKey) {
    if (!workspace) return;
    setBusy(true); setMessage("");
    try {
      await axios.patch("/api/access", { tenantId: workspace.viewer.tenantId, targetUserId, role });
      setMessage("Role updated and recorded in the audit trail."); await load();
    } catch (cause) {
      const error = axios.isAxiosError(cause) ? cause.response?.data?.error ?? cause.message : "Role update failed";
      setMessage(error === "SELF_DEMOTION_BLOCKED" ? "You cannot remove your own Super Admin role." : error);
    }
    setBusy(false);
  }

  return <main className="access-shell">
    <aside className="access-sidebar">
      <a className="access-brand" href="/"><span>EA</span><div>Enterprise<br />Architecture</div></a>
      <div className="tenant-chip"><small>ACTIVE TENANT</small><strong>{workspace?.viewer.tenantName ?? "Loading…"}</strong><span>{workspace?.viewer.tenantStatus ?? "connecting"}</span></div>
      <nav className="access-nav" aria-label="Access workspace">
        <button className={section === "directory" ? "active" : ""} onClick={() => setSection("directory")}><span>01</span>User directory</button>
        <button className={section === "roles" ? "active" : ""} onClick={() => setSection("roles")}><span>02</span>Role catalogue</button>
        <button className={section === "audit" ? "active" : ""} onClick={() => setSection("audit")}><span>03</span>Access audit</button>
      </nav>
      <div className="access-principal"><div>{user.name.slice(0, 1).toUpperCase()}</div><span><strong>{user.name}</strong><small>{workspace ? labels[workspace.viewer.role] : "Resolving access…"}</small></span><a href={signOutPath} aria-label="Sign out">↗</a></div>
    </aside>

    <section className="access-main">
      <header className="access-header"><div><span>Identity & tenant governance</span><h1>{section === "directory" ? "User directory" : section === "roles" ? "Eight-role access model" : "Access audit trail"}</h1></div><a href="/">Architecture workspace ↗</a></header>
      {message && <div className="access-message" role="status">{message}<button onClick={() => setMessage("")}>×</button></div>}

      {section === "directory" && <>
        <div className="access-kpis"><article><span>ACTIVE USERS</span><strong>{workspace?.members.length ?? "—"}</strong><small>in current tenant</small></article><article><span>ROLE MODEL</span><strong>8</strong><small>segregated access roles</small></article><article><span>YOUR ACCESS</span><strong>{workspace ? labels[workspace.viewer.role] : "—"}</strong><small>live server-side decision</small></article></div>
        <div className="directory-tools"><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people or roles…" /></label><span>{members.length} member{members.length === 1 ? "" : "s"}</span></div>
        <div className="member-table"><div className="member-row member-head"><span>Person</span><span>Status</span><span>Access role</span><span>Last active</span></div>{members.map((member) => <article className="member-row" key={member.id}><div className="member-name"><i>{member.displayName.slice(0, 1).toUpperCase()}</i><span><strong>{member.displayName}</strong><small>{member.email}</small></span></div><span className="member-status"><i />{member.status}</span><select aria-label={`Role for ${member.displayName}`} disabled={workspace?.viewer.role !== "super_admin" || busy} value={member.role} onChange={(event) => updateRole(member.id, event.target.value as RoleKey)}>{roles.map((role) => <option value={role.key} key={role.key}>{role.label}</option>)}</select><time>{new Date(member.lastSeenAt * 1000).toLocaleDateString()}</time></article>)}</div>
      </>}

      {section === "roles" && <div className="role-grid">{roles.map((role, index) => <article key={role.key} style={{ "--role": role.tone } as React.CSSProperties}><header><span>{String(index + 1).padStart(2, "0")}</span><i>{role.tier}</i></header><h2>{role.label}</h2><p>{role.scope}</p><ul>{role.permissions.map((permission) => <li key={permission}>{permission}</li>)}</ul><footer><span>{role.key === "tenant_user" ? "TENANT-BOUND" : role.key === "super_admin" ? "PLATFORM-WIDE" : "ADMINISTRATIVE"}</span><b>↗</b></footer></article>)}</div>}

      {section === "audit" && <div className="audit-panel"><div className="audit-rule"><span>IMMUTABLE ACCOUNTING</span><p>Every role assignment records the actor, tenant, target, previous role, new role and timestamp.</p></div>{workspace?.audit.length ? workspace.audit.map((event) => <article key={event.id}><span>{new Date(event.createdAt * 1000).toLocaleString()}</span><div><strong>{event.actorName}</strong> changed <strong>{event.targetName}</strong></div><p>{event.fromRole ? labels[event.fromRole as RoleKey] : "None"} <i>→</i> {event.toRole ? labels[event.toRole as RoleKey] : "None"}</p></article>) : <div className="empty-audit"><strong>No role changes yet</strong><p>Access changes will appear here automatically.</p></div>}</div>}
    </section>
  </main>;
}
