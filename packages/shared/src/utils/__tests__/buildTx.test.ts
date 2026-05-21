import { describe, expect, it, vi } from 'vitest';
import { buildTx } from '#/utils/buildTx';

describe('buildTx', () => {
  it('sets sender before building with the provided Sui client', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const callOrder: string[] = [];
    const tx = {
      setSender: vi.fn(() => {
        callOrder.push('setSender');
      }),
      build: vi.fn(async () => {
        callOrder.push('build');
        return bytes;
      }),
    };
    const suiClient = { id: 'sui-client' };

    await expect(
      buildTx(tx as never, '0xabc', suiClient as never),
    ).resolves.toBe(bytes);

    expect(tx.setSender).toHaveBeenCalledWith('0xabc');
    expect(tx.build).toHaveBeenCalledWith({ client: suiClient });
    expect(callOrder).toEqual(['setSender', 'build']);
  });

  it('propagates build errors', async () => {
    const error = new Error('build failed');
    const tx = {
      setSender: vi.fn(),
      build: vi.fn().mockRejectedValue(error),
    };

    await expect(buildTx(tx as never, '0xabc', {} as never)).rejects.toBe(
      error,
    );
    expect(tx.setSender).toHaveBeenCalledWith('0xabc');
  });

  it('overwrites any pre-existing sender with the wallet address', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    let internalSender = '0xother_address';
    const tx = {
      setSender: vi.fn((addr: string) => {
        internalSender = addr;
      }),
      build: vi.fn().mockResolvedValue(bytes),
    };

    await buildTx(tx as never, '0xwallet_address', {} as never);

    expect(internalSender).toBe('0xwallet_address');
    expect(tx.setSender).toHaveBeenCalledWith('0xwallet_address');
  });
});
