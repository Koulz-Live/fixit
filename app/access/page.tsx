import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import AccessConsole from "./AccessConsole";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const user = await requireChatGPTUser("/access");
  return <AccessConsole user={{ id: user.userId, name: user.displayName, email: user.email }} signOutPath={chatGPTSignOutPath("/")} />;
}
