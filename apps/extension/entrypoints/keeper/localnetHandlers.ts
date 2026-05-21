import type { BackgroundMessage } from '@/lib/background/types';
import { enforceExpiry, getSessionKey, localnetState } from './keeperState';
import type { KeeperSendResponse } from './keeperTypes';
import { localnetGetAddress, localnetSetKeypair, localnetSign } from './local';

export function handleLocalnetSetKeypair(
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  const sessionKey = getSessionKey();

  if (enforceExpiry() || !sessionKey) {
    sendResponse({
      ok: false,
      error: 'Vault must be unlocked to store localnet key',
    });
    return false;
  }

  localnetSetKeypair(
    localnetState,
    sessionKey.derivedKey,
    sessionKey.salt,
    message,
    sendResponse,
  );
  return true;
}

export function handleLocalnetGetAddress(
  _message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  enforceExpiry();
  localnetGetAddress(localnetState, sendResponse);
  return false;
}

export function handleLocalnetSign(
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  if (enforceExpiry()) {
    sendResponse({ ok: false, error: 'No localnet keypair loaded' });
    return false;
  }

  const sessionKey = getSessionKey();
  if (!sessionKey) {
    sendResponse({
      ok: false,
      error: 'Vault must be unlocked to sign with localnet key',
    });
    return false;
  }

  localnetSign(localnetState, message, sendResponse);
  return true;
}
