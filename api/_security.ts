import { createHash, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { ApiIdentity } from "./_supabase.js";

const windows = new Map<string, { count: number; resetAt: number }>();

export function secureResponse(response: VercelResponse, correlationId: string = randomUUID()) {
  response.setHeader("x-correlation-id", correlationId);
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  return correlationId;
}

export function enforceRequestPolicy(request: VercelRequest, response: VercelResponse, limit = 120) {
  const suppliedCorrelation = String(request.headers["x-correlation-id"] ?? "");
  const correlationId = secureResponse(response, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(suppliedCorrelation) ? suppliedCorrelation : randomUUID());
  const forwarded = String(request.headers["x-forwarded-for"] ?? request.socket.remoteAddress ?? "unknown").split(",")[0].trim();
  const key = createHash("sha256").update(`${forwarded}:${request.url}`).digest("hex");
  const now = Date.now(); const current = windows.get(key);
  const window = !current || current.resetAt < now ? { count: 1, resetAt: now + 60_000 } : { count: current.count + 1, resetAt: current.resetAt };
  windows.set(key, window);
  response.setHeader("x-ratelimit-limit", limit); response.setHeader("x-ratelimit-remaining", Math.max(0, limit - window.count));
  if (window.count > limit) { response.status(429).json({ error: "RATE_LIMITED", correlationId }); return { allowed: false, correlationId, ipHash: key } as const; }
  if (["POST","PUT","PATCH","DELETE"].includes(request.method ?? "")) {
    const contentLength = Number(request.headers["content-length"] ?? 0);
    if (contentLength > 64_000) { response.status(413).json({ error: "PAYLOAD_TOO_LARGE", correlationId }); return { allowed: false, correlationId, ipHash: key } as const; }
    const origin = request.headers.origin;
    const host = request.headers["x-forwarded-host"] ?? request.headers.host;
    if (origin && host && new URL(origin).host !== host) { response.status(403).json({ error: "ORIGIN_DENIED", correlationId }); return { allowed: false, correlationId, ipHash: key } as const; }
  }
  return { allowed: true, correlationId, ipHash: key } as const;
}

export async function recordSecurityEvent(identity: ApiIdentity, input: { correlationId: string; ipHash: string; source?: string; category: string; action: string; severity?: string; outcome: string; tenantId?: string | null; resourceType?: string | null; resourceId?: string | null; reasonCode?: string | null; userAgent?: string | null; metadata?: Record<string, unknown> }) {
  const payload = { p_correlation_id: input.correlationId, p_source: input.source ?? "application", p_category: input.category, p_action: input.action, p_severity: input.severity ?? "info", p_outcome: input.outcome, p_tenant_id: input.tenantId ?? null, p_resource_type: input.resourceType ?? null, p_resource_id: input.resourceId ?? null, p_reason_code: input.reasonCode ?? null, p_ip_hash: input.ipHash, p_user_agent: input.userAgent ?? null, p_metadata: input.metadata ?? {} };
  const { error } = await identity.supabase.rpc("record_security_event", payload);
  console.log(JSON.stringify({ type: "security_event", ...input, actorUserId: identity.userId, recordedInSupabase: !error, occurredAt: new Date().toISOString() }));
}
