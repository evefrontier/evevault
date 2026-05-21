import { SUI_LOCALNET_CHAIN } from '@mysten/wallet-standard';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EPOCH_DURATION_MS } from '#/utils/constants';

const mockGetEpoch = vi.fn();
const mockCreateSuiClient = vi.fn((..._args: unknown[]) => ({
  ledgerService: {
    getEpoch: mockGetEpoch,
  },
}));

vi.mock('#/sui/suiClient', () => ({
  createSuiClient: (...args: unknown[]) => mockCreateSuiClient(...args),
}));

vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { getCurrentEpochFromRpc } from '#/sui/rpcEpoch';

describe('getCurrentEpochFromRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a localnet SUI client with the provided URL', async () => {
    mockGetEpoch.mockReturnValue({
      response: Promise.resolve({ epoch: { epoch: 3, start: 1000 } }),
    });

    await getCurrentEpochFromRpc('http://127.0.0.1:9000');

    expect(mockCreateSuiClient).toHaveBeenCalledWith(
      SUI_LOCALNET_CHAIN,
      'http://127.0.0.1:9000',
    );
  });

  it('extracts epochNumber and computes maxEpochTimestampMs', async () => {
    mockGetEpoch.mockReturnValue({
      response: Promise.resolve({ epoch: { epoch: '11', start: '5000' } }),
    });

    await expect(
      getCurrentEpochFromRpc('http://127.0.0.1:9000'),
    ).resolves.toEqual({
      numericMaxEpoch: 11,
      maxEpochTimestampMs: 5000 + DEFAULT_EPOCH_DURATION_MS,
    });
  });

  it('coerces null or undefined epoch fields to 0', async () => {
    mockGetEpoch.mockReturnValue({
      response: Promise.resolve({ epoch: { epoch: null, start: undefined } }),
    });

    await expect(
      getCurrentEpochFromRpc('http://127.0.0.1:9000'),
    ).resolves.toEqual({
      numericMaxEpoch: 0,
      maxEpochTimestampMs: DEFAULT_EPOCH_DURATION_MS,
    });
  });

  it('propagates gRPC errors to the caller', async () => {
    const error = new Error('grpc unavailable');
    mockGetEpoch.mockReturnValue({ response: Promise.reject(error) });

    await expect(getCurrentEpochFromRpc('http://127.0.0.1:9000')).rejects.toBe(
      error,
    );
  });
});
