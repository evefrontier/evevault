import {
  SUI_DEVNET_CHAIN,
  SUI_LOCALNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
} from '@mysten/wallet-standard'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NETWORKS } from '#/sui/networks'

const { mockSuiGrpcClient } = vi.hoisted(() => ({
  mockSuiGrpcClient: vi.fn(),
}))

vi.mock('@mysten/sui/grpc', () => ({
  SuiGrpcClient: mockSuiGrpcClient,
}))

import { createSuiClient } from '#/sui/suiClient'

describe('createSuiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps SUI_TESTNET_CHAIN to the testnet fullnode URL', () => {
    createSuiClient(SUI_TESTNET_CHAIN)

    expect(mockSuiGrpcClient).toHaveBeenCalledWith({
      network: 'testnet',
      baseUrl: NETWORKS.testnet.fullnodeUrl,
    })
  })

  it('maps SUI_MAINNET_CHAIN to the mainnet fullnode URL', () => {
    createSuiClient(SUI_MAINNET_CHAIN)

    expect(mockSuiGrpcClient).toHaveBeenCalledWith({
      network: 'mainnet',
      baseUrl: NETWORKS.mainnet.fullnodeUrl,
    })
  })

  it('maps SUI_DEVNET_CHAIN to the devnet fullnode URL', () => {
    createSuiClient(SUI_DEVNET_CHAIN)

    expect(mockSuiGrpcClient).toHaveBeenCalledWith({
      network: 'devnet',
      baseUrl: NETWORKS.devnet.fullnodeUrl,
    })
  })

  it('throws a descriptive error for localnet without localnetUrl', () => {
    expect(() => createSuiClient(SUI_LOCALNET_CHAIN)).toThrow(
      '[createSuiClient] requires a non-empty localnetUrl when using SUI_LOCALNET_CHAIN.',
    )
  })

  it('throws for an empty localnetUrl', () => {
    expect(() => createSuiClient(SUI_LOCALNET_CHAIN, '   ')).toThrow(
      '[createSuiClient] requires a non-empty localnetUrl when using SUI_LOCALNET_CHAIN.',
    )
  })

  it('uses localnetUrl for SUI_LOCALNET_CHAIN when provided', () => {
    createSuiClient(SUI_LOCALNET_CHAIN, 'http://127.0.0.1:9000')

    expect(mockSuiGrpcClient).toHaveBeenCalledWith({
      network: 'localnet',
      baseUrl: 'http://127.0.0.1:9000',
    })
  })
})
