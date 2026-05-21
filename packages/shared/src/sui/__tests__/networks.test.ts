import {
  SUI_DEVNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
} from '@mysten/wallet-standard';
import { describe, expect, it } from 'vitest';
import { getFaucetUrlForChain, NETWORKS } from '#/sui/networks';

describe('getFaucetUrlForChain', () => {
  it('returns the devnet faucet URL', () => {
    expect(getFaucetUrlForChain(SUI_DEVNET_CHAIN)).toBe(
      NETWORKS.devnet.faucetUrl,
    );
  });

  it('returns the testnet faucet URL', () => {
    expect(getFaucetUrlForChain(SUI_TESTNET_CHAIN)).toBe(
      NETWORKS.testnet.faucetUrl,
    );
  });

  it('returns null for mainnet', () => {
    expect(getFaucetUrlForChain(SUI_MAINNET_CHAIN)).toBeNull();
  });

  it('returns null for a null chain', () => {
    expect(getFaucetUrlForChain(null)).toBeNull();
  });

  it('returns null for an undefined chain', () => {
    expect(getFaucetUrlForChain(undefined)).toBeNull();
  });

  it('returns null for an unknown chain string', () => {
    expect(
      getFaucetUrlForChain('sui:unknown' as typeof SUI_TESTNET_CHAIN),
    ).toBeNull();
  });
});
