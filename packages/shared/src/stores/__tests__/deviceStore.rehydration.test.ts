import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceStore } from '#/stores/deviceStore';
import { KEY_FLAG_ED25519 } from '#/types';
import { DEVICE_STORAGE_KEY } from '#/utils/storageKeys';

vi.mock('#/services/vaultService', () => ({
  ephKeyService: {
    isUnlocked: vi.fn(() => false),
    lock: vi.fn(),
  },
  zkProofService: {},
}));

describe('deviceStore rehydration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useDeviceStore.setState(useDeviceStore.getInitialState());
  });

  afterEach(() => {
    window.localStorage.clear();
    useDeviceStore.persist.clearStorage();
    useDeviceStore.setState(useDeviceStore.getInitialState());
  });

  it('reconstructs the ephemeral public key from persisted bytes', async () => {
    const publicKey = new Ed25519PublicKey(new Uint8Array(32).fill(7));
    const publicKeyFlag = publicKey.flag();

    window.localStorage.setItem(
      DEVICE_STORAGE_KEY,
      JSON.stringify({
        state: {
          ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
          ephemeralPublicKeyFlag: publicKeyFlag,
          ephemeralKeyPairSecretKey: { iv: 'iv', data: 'data', salt: 'salt' },
          isLocked: false,
        },
        version: 0,
      }),
    );

    await useDeviceStore.persist.rehydrate();

    const state = useDeviceStore.getState();
    expect(state.ephemeralPublicKey?.toRawBytes()).toEqual(
      publicKey.toRawBytes(),
    );
    expect(state.ephemeralPublicKeyBytes).toEqual(
      Array.from(publicKey.toRawBytes()),
    );
    expect(state.ephemeralPublicKeyFlag).toBe(publicKeyFlag);
  });

  it('clears persisted public key fields when bytes cannot be reconstructed', async () => {
    window.localStorage.setItem(
      DEVICE_STORAGE_KEY,
      JSON.stringify({
        state: {
          ephemeralPublicKeyBytes: [1, 2, 3],
          ephemeralPublicKeyFlag: KEY_FLAG_ED25519,
          ephemeralKeyPairSecretKey: { iv: 'iv', data: 'data', salt: 'salt' },
          isLocked: false,
        },
        version: 0,
      }),
    );

    await useDeviceStore.persist.rehydrate();

    const state = useDeviceStore.getState();
    expect(state.ephemeralPublicKey).toBeNull();
    expect(state.ephemeralPublicKeyBytes).toBeNull();
    expect(state.ephemeralPublicKeyFlag).toBeNull();
  });
});
