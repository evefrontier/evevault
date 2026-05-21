import {
  decrypt,
  encrypt,
  type HashedData,
  KeeperMessageTypes,
} from '@evevault/shared';
import type { ZkProofResponse } from '@evevault/shared/types';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  SUI_DEVNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from '@mysten/wallet-standard';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createKeeperTestContext,
  setupKeeperSuite,
  TEST_PIN,
} from './keeperTestUtils';

const { mockEncrypt, mockEncryptWithKey, mockSignWithIntent } = vi.hoisted(
  () => ({
    mockEncrypt: vi.fn(),
    mockEncryptWithKey: vi.fn(),
    mockSignWithIntent: vi.fn(),
  }),
);

// Mock only the exports that need per-test control. Everything else uses real
// crypto.
vi.mock('@evevault/shared', async (importActual) => {
  const actual = await importActual<typeof import('@evevault/shared')>();
  return {
    ...actual,
    encrypt: mockEncrypt,
    encryptWithKey: mockEncryptWithKey,
  };
});

vi.mock('@evevault/shared/wallet', () => ({
  signWithIntent: mockSignWithIntent,
}));

// ── keeper loader ─────────────────────────────────────────────────────────────

const ctx = createKeeperTestContext();
const { dispatch, rawDispatch, unlockVault } = ctx;
setupKeeperSuite(ctx);

beforeEach(async () => {
  const actual =
    await vi.importActual<typeof import('@evevault/shared')>(
      '@evevault/shared',
    );
  mockEncrypt.mockImplementation(actual.encrypt);
});

// ── CREATE_KEYPAIR rollback ──────────────────────────────────────────────────

describe('Keeper CREATE_KEYPAIR rollback', () => {
  it('leaves the vault locked when key encryption fails', async () => {
    mockEncrypt.mockRejectedValueOnce(new Error('encrypt failed'));

    const resp = await dispatch({
      type: KeeperMessageTypes.CREATE_KEYPAIR,
      pin: TEST_PIN,
    });
    expect(resp.ok).toBe(false);
    expect(resp.error).toBe('encrypt failed');

    const pubResp = await dispatch({ type: KeeperMessageTypes.GET_PUBLIC_KEY });
    expect(pubResp.error).toBe('LOCKED');
  });
});

// ── ROTATE_KEYPAIR ────────────────────────────────────────────────────────────

describe('Keeper ROTATE_KEYPAIR handler', () => {
  beforeEach(async () => {
    // Restore encryptWithKey to the real implementation for happy-path tests.
    const actual =
      await vi.importActual<typeof import('@evevault/shared')>(
        '@evevault/shared',
      );
    mockEncryptWithKey.mockImplementation(actual.encryptWithKey);
  });

  it('generates a new keypair and encrypts it using the cached session key', async () => {
    const { keypair: original } = await unlockVault();
    const originalAddress = original.getPublicKey().toSuiAddress();

    const rotateResp = await dispatch({
      type: KeeperMessageTypes.ROTATE_KEYPAIR,
    });

    expect(rotateResp.ok).toBe(true);
    expect(rotateResp.hashedSecretKey).toMatchObject({
      iv: expect.any(String),
      data: expect.any(String),
      salt: expect.any(String),
    });
    expect(rotateResp.publicKeyBytes).toEqual(expect.any(Array));

    // Public key must have changed
    const pkResp = await dispatch({ type: KeeperMessageTypes.GET_PUBLIC_KEY });
    const newAddress = Buffer.from(
      new Uint8Array(pkResp.publicKeyBytes as number[]),
    ).toString('hex');
    expect(newAddress).not.toBe(
      Buffer.from(original.getPublicKey().toRawBytes()).toString('hex'),
    );
  });

  it('only swaps the in-memory key after encryption succeeds', async () => {
    await unlockVault();

    // Capture the original public key bytes before the failed rotation
    const beforeResp = await dispatch({
      type: KeeperMessageTypes.GET_PUBLIC_KEY,
    });
    const originalPkBytes = beforeResp.publicKeyBytes as number[];

    // Make the next encryptWithKey call fail
    mockEncryptWithKey.mockRejectedValueOnce(new Error('encrypt failed'));

    const rotateResp = await dispatch({
      type: KeeperMessageTypes.ROTATE_KEYPAIR,
    });
    expect(rotateResp.ok).toBe(false);
    expect(rotateResp.error).toBe('encrypt failed');

    // The in-memory key must be unchanged — GET_PUBLIC_KEY returns the original key
    const afterResp = await dispatch({
      type: KeeperMessageTypes.GET_PUBLIC_KEY,
    });
    expect(afterResp.publicKeyBytes).toEqual(originalPkBytes);
  });

  it('returns an unlock-required error when the vault is locked', async () => {
    // Vault is already cleared (afterEach ensures this), so no unlockVault call
    const resp = await dispatch({ type: KeeperMessageTypes.ROTATE_KEYPAIR });

    expect(resp.ok).toBe(false);
    expect(resp.error).toBe(
      'Vault must be unlocked again before rotating keypair',
    );
  });

  it('does not extend the vault expiry after a successful rotation', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const T0 = 1_000_000_000_000;
    vi.setSystemTime(T0);

    await unlockVault(); // _vaultUnlockExpiry = T0 + 10 min

    // Advance 9 minutes and rotate — expiry stays at T0 + 10 min
    vi.setSystemTime(T0 + 9 * 60 * 1000);
    const rotResp = await dispatch({ type: KeeperMessageTypes.ROTATE_KEYPAIR });
    expect(rotResp.ok).toBe(true);

    // Past the original expiry (T0 + 10min): vault locks despite recent rotation
    vi.setSystemTime(T0 + 10 * 60 * 1000 + 1000);
    const nowLocked = await dispatch({
      type: KeeperMessageTypes.GET_PUBLIC_KEY,
    });
    expect(nowLocked.error).toBe('LOCKED');
  });
});

// ── EPH_SIGN ──────────────────────────────────────────────────────────────────

describe('Keeper EPH_SIGN handler', () => {
  beforeEach(async () => {
    await unlockVault();
  });

  it('returns LOCKED when the vault is locked', async () => {
    // Lock first, then attempt to sign
    await dispatch({ type: KeeperMessageTypes.CLEAR_EPHKEY });

    const resp = await dispatch({
      type: KeeperMessageTypes.EPH_SIGN,
      msgBytes: [1],
    });

    expect(resp.error).toBe('[KEEPER_EPH_SIGN] LOCKED');
  });

  it('converts msgBytes to Uint8Array and signs with intent', async () => {
    mockSignWithIntent.mockResolvedValue({
      bytes: 'signed-bytes',
      userSignature: 'user-signature',
    });

    const resp = await dispatch({
      type: KeeperMessageTypes.EPH_SIGN,
      msgBytes: [1, 2, 3],
      scope: 'TransactionData',
      sui_address: '0xabc',
    });

    expect(resp.ok).toBe(true);
    expect(resp.bytes).toBe('signed-bytes');
    expect(resp.userSignature).toBe('user-signature');

    expect(mockSignWithIntent).toHaveBeenCalledOnce();
    const [passedBytes, passedScope, passedCtx] =
      mockSignWithIntent.mock.calls[0];
    expect(passedBytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(passedBytes as Uint8Array)).toEqual([1, 2, 3]);
    expect(passedScope).toBe('TransactionData');
    expect((passedCtx as { sui_address: string }).sui_address).toBe('0xabc');
    expect((passedCtx as { keypair: unknown }).keypair).toBeInstanceOf(
      Ed25519Keypair,
    );
  });

  it('returns an error when signWithIntent throws', async () => {
    mockSignWithIntent.mockRejectedValue(new Error('sign failed'));

    const resp = await dispatch({
      type: KeeperMessageTypes.EPH_SIGN,
      msgBytes: [1, 2, 3],
    });

    expect(resp.ok).toBe(false);
    expect(resp.error).toBe('sign failed');
  });

  it('returns false without responding for non-KEEPER targets', () => {
    const { returnValue, sendResponse } = rawDispatch({
      target: 'OTHER',
      type: KeeperMessageTypes.EPH_SIGN,
    });

    expect(returnValue).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });
});

// ── zkProof handlers ──────────────────────────────────────────────────────────

describe('Keeper zkProof handlers', () => {
  const proof = {
    data: { proofPoints: { a: [], b: [], c: [] } },
    error: undefined,
  } as unknown as ZkProofResponse;

  beforeEach(async () => {
    await unlockVault();
  });

  it('SET_ZKPROOF rejects when the vault is locked', async () => {
    await dispatch({ type: KeeperMessageTypes.CLEAR_EPHKEY });

    const resp = await dispatch({
      type: KeeperMessageTypes.SET_ZKPROOF,
      chain: SUI_TESTNET_CHAIN,
      zkProof: proof,
    });

    expect(resp.error).toBe(
      '[KEEPER_SET_ZKPROOF] No ephemeral key found, vault LOCKED',
    );
  });

  it('SET_ZKPROOF rejects after the unlock window elapses', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);

    const resp = await dispatch({
      type: KeeperMessageTypes.SET_ZKPROOF,
      chain: SUI_TESTNET_CHAIN,
      zkProof: proof,
    });

    expect(resp.error).toBe(
      '[KEEPER_SET_ZKPROOF] No ephemeral key found, vault LOCKED',
    );
  });

  it('SET_ZKPROOF rejects when chain is missing', async () => {
    const resp = await dispatch({
      type: KeeperMessageTypes.SET_ZKPROOF,
      zkProof: proof,
    });

    expect(resp.error).toBe('Chain is required');
  });

  it('SET_ZKPROOF stores proof per chain and GET_ZKPROOF retrieves it', async () => {
    const setResp = await dispatch({
      type: KeeperMessageTypes.SET_ZKPROOF,
      chain: SUI_TESTNET_CHAIN as SuiChain,
      zkProof: proof,
    });
    expect(setResp.ok).toBe(true);

    const getResp = await dispatch({
      type: KeeperMessageTypes.GET_ZKPROOF,
      chain: SUI_TESTNET_CHAIN as SuiChain,
    });
    expect(getResp.ok).toBe(true);
    expect(getResp.zkProof).toEqual(proof);

    // Other chains unaffected
    const devResp = await dispatch({
      type: KeeperMessageTypes.GET_ZKPROOF,
      chain: SUI_DEVNET_CHAIN as SuiChain,
    });
    expect(devResp.zkProof).toBeNull();
  });

  it('GET_ZKPROOF rejects when the vault is locked', async () => {
    await dispatch({ type: KeeperMessageTypes.CLEAR_EPHKEY });

    const resp = await dispatch({
      type: KeeperMessageTypes.GET_ZKPROOF,
      chain: SUI_TESTNET_CHAIN as SuiChain,
    });

    expect(resp.error).toBe('LOCKED');
  });

  it('GET_ZKPROOF rejects after the unlock window elapses', async () => {
    await dispatch({
      type: KeeperMessageTypes.SET_ZKPROOF,
      chain: SUI_TESTNET_CHAIN as SuiChain,
      zkProof: proof,
    });

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);

    const resp = await dispatch({
      type: KeeperMessageTypes.GET_ZKPROOF,
      chain: SUI_TESTNET_CHAIN as SuiChain,
    });

    expect(resp.error).toBe('LOCKED');
  });

  it('GET_ZKPROOF rejects when chain is missing', async () => {
    const resp = await dispatch({ type: KeeperMessageTypes.GET_ZKPROOF });

    expect(resp.error).toBe('Chain is required');
  });

  it('GET_ZKPROOF returns null for an unset chain', async () => {
    const resp = await dispatch({
      type: KeeperMessageTypes.GET_ZKPROOF,
      chain: SUI_TESTNET_CHAIN as SuiChain,
    });

    expect(resp.ok).toBe(true);
    expect(resp.zkProof).toBeNull();
  });

  it('CLEAR_ZKPROOF resets every chain regardless of lock state', async () => {
    // Populate proofs on all chains while unlocked
    for (const chain of [
      SUI_DEVNET_CHAIN,
      SUI_TESTNET_CHAIN,
      SUI_MAINNET_CHAIN,
    ] as SuiChain[]) {
      await dispatch({
        type: KeeperMessageTypes.SET_ZKPROOF,
        chain,
        zkProof: proof,
      });
    }

    // Lock the vault — CLEAR_ZKPROOF must work regardless of lock state
    await dispatch({ type: KeeperMessageTypes.CLEAR_EPHKEY });

    const clearResp = await dispatch({
      type: KeeperMessageTypes.CLEAR_ZKPROOF,
    });
    expect(clearResp.ok).toBe(true);

    // Re-unlock so GET_ZKPROOF's ephemeral-key guard passes, then verify proofs are gone
    await unlockVault();
    for (const chain of [
      SUI_DEVNET_CHAIN,
      SUI_TESTNET_CHAIN,
      SUI_MAINNET_CHAIN,
    ] as SuiChain[]) {
      const getResp = await dispatch({
        type: KeeperMessageTypes.GET_ZKPROOF,
        chain,
      });
      expect(getResp.zkProof).toBeNull();
    }
  });

  it('unknown keeper message type sends a standard error', async () => {
    const resp = await dispatch({ type: 'UNKNOWN_MESSAGE' });

    expect(resp.error).toBe('Unknown message type');
  });
});

// ── LOCALNET_SET_KEYPAIR ──────────────────────────────────────────────────────

describe('Keeper LOCALNET_SET_KEYPAIR handler', () => {
  beforeEach(async () => {
    const actual =
      await vi.importActual<typeof import('@evevault/shared')>(
        '@evevault/shared',
      );
    mockEncryptWithKey.mockImplementation(actual.encryptWithKey);
    await unlockVault();
  });

  it('loads keypair into RAM and returns encrypted blob when vault is unlocked', async () => {
    const keypair = Ed25519Keypair.generate();
    const bech32 = keypair.getSecretKey();

    const resp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_SET_KEYPAIR,
      privateKey: bech32,
    });

    expect(resp.ok).toBe(true);
    expect(resp.address).toBe(keypair.getPublicKey().toSuiAddress());
    const enc = resp.encryptedKey as HashedData;
    expect(enc).toMatchObject({
      iv: expect.any(String),
      data: expect.any(String),
      salt: expect.any(String),
    });
    expect(enc.data).not.toBe(bech32);
  });

  it('encrypted blob is recoverable with the vault PIN (session key is PIN-derived)', async () => {
    // LOCALNET_SET_KEYPAIR stores the key via encryptWithKey(privateKey, sessionDerivedKey, sessionSalt).
    // sessionDerivedKey is derived from TEST_PIN + sessionSalt during UNLOCK_VAULT, so the
    // resulting ciphertext is compatible with decrypt(blob, TEST_PIN) which re-derives the
    // same key internally. If session key derivation ever changes to use a different source,
    // this round-trip test will catch it.
    const keypair = Ed25519Keypair.generate();
    const bech32 = keypair.getSecretKey();

    const resp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_SET_KEYPAIR,
      privateKey: bech32,
    });

    const decrypted = await decrypt(resp.encryptedKey as HashedData, TEST_PIN);
    expect(decrypted).toBe(bech32);
  });

  it('after CLEAR_EPHKEY, LOCALNET_SET_KEYPAIR fails until vault is unlocked again', async () => {
    // Simulates locked keeper: unlock sets sessionDerivedKey/sessionSalt;
    // CLEAR_EPHKEY clears them (same branch as never unlocked for this handler).
    await dispatch({ type: KeeperMessageTypes.CLEAR_EPHKEY });
    const keypair = Ed25519Keypair.generate();

    const resp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_SET_KEYPAIR,
      privateKey: keypair.getSecretKey(),
    });

    expect(resp.ok).toBe(false);
    expect(resp.error).toBe('Vault must be unlocked to store localnet key');
  });

  it('after expiry, LOCALNET_SET_KEYPAIR fails until vault is unlocked again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);

    const resp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_SET_KEYPAIR,
      privateKey: Ed25519Keypair.generate().getSecretKey(),
    });

    expect(resp.ok).toBe(false);
    expect(resp.error).toBe('Vault must be unlocked to store localnet key');
  });

  it('after expiry, LOCALNET_GET_ADDRESS clears and hides a loaded key', async () => {
    const keypair = Ed25519Keypair.generate();
    await dispatch({
      type: KeeperMessageTypes.LOCALNET_SET_KEYPAIR,
      privateKey: keypair.getSecretKey(),
    });

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);

    const resp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
    });

    expect(resp.ok).toBe(true);
    expect(resp.address).toBeNull();
  });

  it('after expiry, LOCALNET_SIGN rejects a loaded key', async () => {
    const keypair = Ed25519Keypair.generate();
    await dispatch({
      type: KeeperMessageTypes.LOCALNET_SET_KEYPAIR,
      privateKey: keypair.getSecretKey(),
    });

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);

    const resp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_SIGN,
      msgBytes: [1],
      scope: 'TransactionData',
      suiAddress: keypair.getPublicKey().toSuiAddress(),
    });

    expect(resp.ok).toBe(false);
    expect(resp.error).toBe('No localnet keypair loaded');
    expect(mockSignWithIntent).not.toHaveBeenCalled();
  });

  it('returns error when privateKey is missing', async () => {
    const resp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_SET_KEYPAIR,
    });

    expect(resp.ok).toBe(false);
    expect(resp.error).toBe('privateKey required');
  });

  it('returns error when private key does not start with suiprivkey1', async () => {
    const resp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_SET_KEYPAIR,
      privateKey: 'not-a-valid-key',
    });

    expect(resp.ok).toBe(false);
    expect(resp.error).toBe('Invalid private key');
  });
});

// ── UNLOCK_VAULT — localnet key restoration ───────────────────────────────────

describe('Keeper UNLOCK_VAULT — localnet key restoration', () => {
  it('restores localnet keypair from encrypted blob on unlock', async () => {
    const localnetKeypair = Ed25519Keypair.generate();
    const bech32 = localnetKeypair.getSecretKey();
    const encrypted = await encrypt(bech32, TEST_PIN);

    const resp = await dispatch({
      type: KeeperMessageTypes.UNLOCK_VAULT,
      hashedSecretKey: await encrypt(
        Ed25519Keypair.generate().getSecretKey(),
        TEST_PIN,
      ),
      pin: TEST_PIN,
      encryptedLocalnetKey: encrypted,
    });

    expect(resp.ok).toBe(true);

    // Verify the localnet key was restored by requesting its address
    const addrResp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
    });
    expect(addrResp.ok).toBe(true);
    expect(addrResp.address).toBe(
      localnetKeypair.getPublicKey().toSuiAddress(),
    );
  });

  it('leaves localnetKey null when no encrypted blob is passed', async () => {
    const ephKeypair = Ed25519Keypair.generate();
    const hashedSecretKey = await encrypt(ephKeypair.getSecretKey(), TEST_PIN);

    const resp = await dispatch({
      type: KeeperMessageTypes.UNLOCK_VAULT,
      hashedSecretKey,
      pin: TEST_PIN,
    });

    expect(resp.ok).toBe(true);

    const addrResp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
    });
    expect(addrResp.ok).toBe(true);
    expect(addrResp.address).toBeNull();
  });

  it('leaves localnetKey null and does not throw when blob is malformed', async () => {
    const ephKeypair = Ed25519Keypair.generate();
    const hashedSecretKey = await encrypt(ephKeypair.getSecretKey(), TEST_PIN);

    const resp = await dispatch({
      type: KeeperMessageTypes.UNLOCK_VAULT,
      hashedSecretKey,
      pin: TEST_PIN,
      encryptedLocalnetKey: { iv: 'bad', data: 'bad', salt: 'bad' },
    });

    expect(resp.ok).toBe(true);

    const addrResp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
    });
    expect(addrResp.address).toBeNull();
  });

  it('leaves localnetKey null when wrong PIN is used to decrypt', async () => {
    const localnetKeypair = Ed25519Keypair.generate();
    const encrypted = await encrypt(localnetKeypair.getSecretKey(), TEST_PIN);
    const ephKeypair = Ed25519Keypair.generate();
    const hashedSecretKey = await encrypt(
      ephKeypair.getSecretKey(),
      'wrong-pin',
    );

    const resp = await dispatch({
      type: KeeperMessageTypes.UNLOCK_VAULT,
      hashedSecretKey,
      pin: 'wrong-pin',
      encryptedLocalnetKey: encrypted, // encrypted with TEST_PIN, not wrong-pin
    });

    // The ephemeral key unlock itself may fail (wrong PIN), but localnet key should be null
    expect(resp.ok).toBe(true);
    const addrResp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
    });
    expect(addrResp.address).toBeNull();
  });

  it("ignores a plain string (old unencrypted format) — no 'data' property", async () => {
    const ephKeypair = Ed25519Keypair.generate();
    const hashedSecretKey = await encrypt(ephKeypair.getSecretKey(), TEST_PIN);

    const resp = await dispatch({
      type: KeeperMessageTypes.UNLOCK_VAULT,
      hashedSecretKey,
      pin: TEST_PIN,
      encryptedLocalnetKey: 'suiprivkey1abc', // plain string, not a HashedData object
    });

    expect(resp.ok).toBe(true);

    const addrResp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
    });
    expect(addrResp.address).toBeNull();
  });
});
