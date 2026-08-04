import { getChatGPTUser } from "../../chatgpt-auth";
import { createServiceRequest, getMarketplaceWorkspace } from "../../../db/marketplace";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  try { return Response.json(await getMarketplaceWorkspace(user)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Marketplace unavailable" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const title = String(body.title ?? "").trim(); const description = String(body.description ?? "").trim(); const discipline = String(body.discipline ?? ""); const areaLabel = String(body.areaLabel ?? "").trim();
  const budgetMinMinor = Math.round(Number(body.budgetMin ?? 0) * 100); const budgetMaxMinor = Math.round(Number(body.budgetMax ?? 0) * 100);
  if (title.length < 5 || description.length < 10 || !areaLabel || budgetMinMinor < 0 || budgetMaxMinor < budgetMinMinor) return Response.json({ error: "Please provide a valid title, description, area and budget range." }, { status: 400 });
  try { return Response.json(await createServiceRequest(user, { title, description, discipline, areaLabel, budgetMinMinor, budgetMaxMinor }), { status: 201 }); }
  catch (error) { const message = error instanceof Error ? error.message : "Request creation failed"; return Response.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 409 }); }
}
