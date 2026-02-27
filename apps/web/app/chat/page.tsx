import type { Metadata } from "next";
import { ChatPageClient } from "./ChatPageClient";

export const metadata: Metadata = {
  title: "Chat — AgentLaunch",
  description: "Talk to your on-chain AI agents using token-gated AI credits.",
};

export default function ChatPage() {
  return <ChatPageClient />;
}
