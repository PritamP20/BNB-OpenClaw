import type { Metadata } from "next";
import { ExploreClient } from "./ExploreClient";

export const metadata: Metadata = {
    title: "Explore Tokens — AgentLaunch",
    description:
        "Browse all AI agents, fungible tokens, and skill modules launched on BNB Chain. Sort by market cap, volume, or reputation.",
};

export default function ExplorePage() {
    return <ExploreClient />;
}
