import { createConfig, http } from "wagmi";
import { bsc, bscTestnet } from "wagmi/chains";
import { metaMask } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [bscTestnet, bsc],
  connectors: [
    metaMask(),
  ],
  transports: {
    [bscTestnet.id]: http("https://bsc-testnet-rpc.publicnode.com"),
    [bsc.id]: http("https://bsc-dataseed.binance.org"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
