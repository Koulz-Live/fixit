import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import MarketplaceApp from "./MarketplaceApp";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const user = await requireChatGPTUser("/marketplace");
  return <MarketplaceApp user={{ name: user.displayName, email: user.email }} signOutPath={chatGPTSignOutPath("/")} />;
}
