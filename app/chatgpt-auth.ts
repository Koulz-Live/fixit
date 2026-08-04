import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";

export type ChatGPTUser = { userId: string; displayName: string; email: string; fullName: string | null };

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  return { userId: user.id, email: user.email, fullName, displayName: fullName ?? user.email.split("@")[0] };
}

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(`/login?return_to=${encodeURIComponent(returnTo.startsWith("/") ? returnTo : "/")}`);
}

export function chatGPTSignOutPath(returnTo = "/") { return `/auth/signout?return_to=${encodeURIComponent(returnTo)}`; }
