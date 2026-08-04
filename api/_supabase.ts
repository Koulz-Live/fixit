import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { VercelRequest } from "@vercel/node";

export type ApiIdentity = { user: User; userId: string; email: string; displayName: string; supabase: SupabaseClient };

export async function requireIdentity(request: VercelRequest): Promise<ApiIdentity> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!url || !key) throw new Error("SERVER_CONFIGURATION_ERROR");
  if (!token) throw new Error("AUTHENTICATION_REQUIRED");
  const supabase = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) throw new Error("AUTHENTICATION_REQUIRED");
  const displayName = typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : data.user.email.split("@")[0];
  return { user: data.user, userId: data.user.id, email: data.user.email, displayName, supabase };
}

export function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return { message, status: message === "AUTHENTICATION_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : message === "SERVER_CONFIGURATION_ERROR" ? 503 : 500 };
}
