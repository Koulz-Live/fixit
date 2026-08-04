import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient(); await supabase.auth.signOut();
  const url = new URL(request.url); const returnTo = url.searchParams.get("return_to");
  return NextResponse.redirect(new URL(returnTo?.startsWith("/") ? returnTo : "/", url.origin));
}
