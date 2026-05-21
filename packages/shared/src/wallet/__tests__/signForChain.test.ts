import type { User } from 'oidc-client-ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/wallet/zkSignAny', () => ({
  zkSignAny: vi.fn(),
}));

import { SUI_LOCALNET_CHAIN, SUI_TESTNET_CHAIN } from '@mysten/wallet-standard';
import { signForChain } from '#/wallet/signForChain';
import { zkSignAny } from '#/wallet/zkSignAny';

type ChromeStub = { runtime?: { sendMessage?: unknown } };

const MSG = new Uint8Array([1, 2, 3]);
const LOCALNET = SUI_LOCALNET_CHAIN;
const TESTNET = SUI_TESTNET_CHAIN;
const LOCAL_ADDR = '0xlocal';

const minimalUser = {
  profile: { sui_address: '0x1', salt: '1', sub: 'sub', aud: 'aud' },
} as unknown as User;

function setChrome(sendMessage: unknown) {
  (globalThis as unknown as { chrome: ChromeStub }).chrome = {
    runtime: { sendMessage },
  };
}

function clearChrome() {
  delete (globalThis as unknown as { chrome?: ChromeStub }).chrome;
}

describe('signForChain — localnet path', () => {
  afterEach(() => {
    clearChrome();
    vi.clearAllMocks();
  });

  it('throws when localnetAddress is missing', async () => {
    await expect(
      signForChain('PersonalMessage', MSG, {
        chain: LOCALNET,
        user: null,
        getZkProof: null,
        localnetAddress: null,
      }),
    ).rejects.toThrow('[signForChain] No localnet address');
  });

  it('throws when chrome.runtime returns no response', async () => {
    setChrome(vi.fn().mockResolvedValue(undefined));

    await expect(
      signForChain('PersonalMessage', MSG, {
        chain: LOCALNET,
        user: null,
        getZkProof: null,
        localnetAddress: LOCAL_ADDR,
      }),
    ).rejects.toThrow('No response from background script');
  });

  it('throws with response.error when ok is false', async () => {
    setChrome(vi.fn().mockResolvedValue({ ok: false, error: 'keeper locked' }));

    await expect(
      signForChain('PersonalMessage', MSG, {
        chain: LOCALNET,
        user: null,
        getZkProof: null,
        localnetAddress: LOCAL_ADDR,
      }),
    ).rejects.toThrow('keeper locked');
  });

  it("throws 'Failed to sign bytes' when ok is false and no error field", async () => {
    setChrome(vi.fn().mockResolvedValue({ ok: false }));

    await expect(
      signForChain('PersonalMessage', MSG, {
        chain: LOCALNET,
        user: null,
        getZkProof: null,
        localnetAddress: LOCAL_ADDR,
      }),
    ).rejects.toThrow('Failed to sign bytes');
  });

  it('returns { bytes, signature } on success', async () => {
    setChrome(
      vi.fn().mockResolvedValue({
        ok: true,
        bytes: 'b64bytes',
        signature: 'b64sig',
      }),
    );

    const result = await signForChain('TransactionData', MSG, {
      chain: LOCALNET,
      user: null,
      getZkProof: null,
      localnetAddress: LOCAL_ADDR,
    });

    expect(result).toEqual({ bytes: 'b64bytes', signature: 'b64sig' });
  });

  it('serialises msgBytes as a plain array in the message', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      bytes: 'b',
      signature: 's',
    });
    setChrome(sendMessage);

    await signForChain('PersonalMessage', MSG, {
      chain: LOCALNET,
      user: null,
      getZkProof: null,
      localnetAddress: LOCAL_ADDR,
    });

    const sentPayload = sendMessage.mock.calls[0][0];
    expect(Array.isArray(sentPayload.msgBytes)).toBe(true);
    expect(sentPayload.suiAddress).toBe(LOCAL_ADDR);
  });
});

describe('signForChain — zkLogin path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when user is null', async () => {
    await expect(
      signForChain('PersonalMessage', MSG, {
        chain: TESTNET,
        user: null,
        getZkProof: null,
        localnetAddress: null,
      }),
    ).rejects.toThrow('User not found');
  });

  it('throws when getZkProof is null', async () => {
    await expect(
      signForChain('PersonalMessage', MSG, {
        chain: TESTNET,
        user: minimalUser,
        getZkProof: null,
        localnetAddress: null,
      }),
    ).rejects.toThrow('getZkProof is required');
  });

  it('delegates to zkSignAny and remaps the signature field', async () => {
    vi.mocked(zkSignAny).mockResolvedValue({
      bytes: 'zk_bytes',
      zkSignature: 'zk_sig',
    });

    const result = await signForChain('PersonalMessage', MSG, {
      chain: TESTNET,
      user: minimalUser,
      getZkProof: vi.fn(),
      localnetAddress: null,
    });

    expect(zkSignAny).toHaveBeenCalled();
    expect(result).toEqual({ bytes: 'zk_bytes', signature: 'zk_sig' });
  });
});
