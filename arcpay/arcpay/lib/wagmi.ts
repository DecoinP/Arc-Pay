'use client'
import { createConfig, http } from 'wagmi'
import { metaMask, injected } from 'wagmi/connectors'
import { arcTestnet } from './arc'

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [
    injected(),
    metaMask(),
  ],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
  },
  ssr: true,
})
