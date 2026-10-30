import { SUI_LOCALNET_CHAIN } from '@mysten/wallet-standard'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mockQuery = vi.fn()

vi.mock('#/sui/graphqlClient', () => ({
  createSuiGraphQLClient: vi.fn(() => ({ query: mockQuery })),
}))

vi.mock('#/utils/localDev', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/utils/localDev')>()),
  LOCAL_DEV: true,
  LOCAL_DEV_SESSION_EPOCHS: 30,
}))

vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import { getCurrentEpochFromGraphQL } from '#/sui/graphqlEpoch'
import { LOCAL_DEV_EPOCH_QUERY } from '#/sui/queries/epoch'

describe('getCurrentEpochFromGraphQL (LOCAL_DEV)', () => {
  const startTimestamp = '2026-10-30T08:00:00.000Z'
  const hourMs = 3_600_000

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('asks for 30 more epochs, timed by the chain epoch length from its system state', async () => {
    mockQuery.mockResolvedValue({
      data: {
        epoch: {
          epochId: '7',
          startTimestamp,
          endTimestamp: null,
          systemState: {
            json: { parameters: { epoch_duration_ms: String(hourMs) } },
          },
        },
      },
    })

    await expect(
      getCurrentEpochFromGraphQL(SUI_LOCALNET_CHAIN),
    ).resolves.toEqual({
      numericMaxEpoch: 37,
      maxEpochTimestampMs: new Date(startTimestamp).getTime() + 31 * hourMs,
    })
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ query: LOCAL_DEV_EPOCH_QUERY }),
    )
  })
})
