import { KeeperMessageTypes } from '@evevault/shared';
import type { BackgroundMessage } from '@/lib/background/types';
import type { KeeperHandler, KeeperSendResponse } from './keeperTypes';
import {
  handleLocalnetGetAddress,
  handleLocalnetSetKeypair,
  handleLocalnetSign,
} from './localnetHandlers';
import {
  handleClearEphKey,
  handleCreateKeypair,
  handleEphSign,
  handleGetPublicKey,
  handleRotateKeypair,
  handleUnlockVault,
} from './vaultHandlers';
import {
  handleClearZkProof,
  handleGetZkProof,
  handleSetZkProof,
} from './zkProofHandlers';

const keeperHandlers: Partial<Record<KeeperMessageTypes, KeeperHandler>> = {
  [KeeperMessageTypes.CREATE_KEYPAIR]: handleCreateKeypair,
  [KeeperMessageTypes.UNLOCK_VAULT]: handleUnlockVault,
  [KeeperMessageTypes.GET_PUBLIC_KEY]: handleGetPublicKey,
  [KeeperMessageTypes.ROTATE_KEYPAIR]: handleRotateKeypair,
  [KeeperMessageTypes.EPH_SIGN]: handleEphSign,
  [KeeperMessageTypes.SET_ZKPROOF]: handleSetZkProof,
  [KeeperMessageTypes.GET_ZKPROOF]: handleGetZkProof,
  [KeeperMessageTypes.CLEAR_EPHKEY]: handleClearEphKey,
  [KeeperMessageTypes.CLEAR_ZKPROOF]: handleClearZkProof,
  [KeeperMessageTypes.LOCALNET_SET_KEYPAIR]: handleLocalnetSetKeypair,
  [KeeperMessageTypes.LOCALNET_GET_ADDRESS]: handleLocalnetGetAddress,
  [KeeperMessageTypes.LOCALNET_SIGN]: handleLocalnetSign,
};

/**
 * Thin router used by keeper.ts. Each handler returns Chrome's listener result:
 * true for async sendResponse paths, false for synchronous responses.
 */
export function handleKeeperMessage(
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  if (message.target !== 'KEEPER') {
    return false;
  }

  const handler = keeperHandlers[message.type as KeeperMessageTypes];
  if (!handler) {
    sendResponse({ error: 'Unknown message type' });
    return false;
  }

  return handler(message, sendResponse);
}

export type { KeeperSendResponse };
