import { SUI_TESTNET_CHAIN } from '@mysten/wallet-standard';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EPOCH_DURATION_MS } from '#/utils/constants';

const mockQuery = vi.fn();

vi.mock('#/sui/graphqlClient', () => ({
  createSuiGraphQLClient: vi.fn(() => ({ query: mockQuery })),
}));

vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { getCurrentEpochFromGraphQL } from '#/sui/graphqlEpoch';

describe('getCurrentEpochFromGraphQL', () => {
  const startTimestamp = '2026-05-08T00:00:00.000Z';
  const endTimestamp = '2026-05-09T00:00:00.000Z';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns numericMaxEpoch and maxEpochTimestampMs from a valid GraphQL response', async () => {
    mockQuery.mockResolvedValue({
      data: {
        epoch: {
          epochId: '42',
          startTimestamp,
          endTimestamp,
        },
      },
    });

    await expect(
      getCurrentEpochFromGraphQL(SUI_TESTNET_CHAIN),
    ).resolves.toEqual({
      numericMaxEpoch: 42,
      maxEpochTimestampMs: new Date(endTimestamp).getTime(),
    });
  });

  it('throws when the response contains GraphQL errors', async () => {
    mockQuery.mockResolvedValue({
      errors: [{ message: 'first' }, { message: 'second' }],
    });

    await expect(getCurrentEpochFromGraphQL(SUI_TESTNET_CHAIN)).rejects.toThrow(
      'GraphQL epoch query failed: first, second',
    );
  });

  it('throws when epoch is null in the response', async () => {
    mockQuery.mockResolvedValue({ data: { epoch: null } });

    await expect(getCurrentEpochFromGraphQL(SUI_TESTNET_CHAIN)).rejects.toThrow(
      'Failed to get epoch data from GraphQL',
    );
  });

  it('falls back to startTimestamp + DEFAULT_EPOCH_DURATION_MS when endTimestamp is null', async () => {
    mockQuery.mockResolvedValue({
      data: {
        epoch: {
          epochId: '7',
          startTimestamp,
          endTimestamp: null,
        },
      },
    });

    await expect(
      getCurrentEpochFromGraphQL(SUI_TESTNET_CHAIN),
    ).resolves.toEqual({
      numericMaxEpoch: 7,
      maxEpochTimestampMs:
        new Date(startTimestamp).getTime() + DEFAULT_EPOCH_DURATION_MS,
    });
  });

  it('falls back to startTimestamp + DEFAULT_EPOCH_DURATION_MS when endTimestamp is missing', async () => {
    mockQuery.mockResolvedValue({
      data: {
        epoch: {
          epochId: '8',
          startTimestamp,
        },
      },
    });

    await expect(
      getCurrentEpochFromGraphQL(SUI_TESTNET_CHAIN),
    ).resolves.toEqual({
      numericMaxEpoch: 8,
      maxEpochTimestampMs:
        new Date(startTimestamp).getTime() + DEFAULT_EPOCH_DURATION_MS,
    });
  });

  it('propagates a network-level error thrown by the GraphQL client', async () => {
    mockQuery.mockRejectedValue(new Error('Network unreachable'));

    await expect(getCurrentEpochFromGraphQL(SUI_TESTNET_CHAIN)).rejects.toThrow(
      'Network unreachable',
    );
  });
});
