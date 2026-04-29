/// <reference types="chrome"/>

import {
  decrypt,
  deriveAesKey,
  encrypt,
  encryptWithKey,
  ephSign,
  type HashedData,
  KeeperMessageTypes,
  type ZkProofResponse,
} from "@evevault/shared";
import type { IntentScope } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { SuiChain } from "@mysten/wallet-standard";
import type { BackgroundMessage } from "@/lib/background/types";
import {
  type LocalnetState,
  localnetGetAddress,
  localnetSetKeypair,
  localnetSign,
} from "./local";
import {
  clearPersistedKeeperState,
  persistKeeperState,
  restoreKeeperState,
} from "./sessionPersistence";

/**
 * Keeper - Holds the ephemeral key in RAM-only memory
 * This offscreen document stays alive much longer than the service worker
 * and provides a stable place to store the decrypted ephemeral key.
 */

// RAM-only storage for the ephemeral key
let ephemeralKey: Ed25519Keypair | null = null;

// RAM-only storage for the localnet dev keypair
const localnetState: LocalnetState = { localnetKey: null };

// Rotation re-encrypts the new ephemeral secret key without requiring the user
// to re-enter their PIN. We derive a non-extractable CryptoKey at unlock time.
// The browser's WebCrypto engine holds the actual key bytes — they are never
// exposed to JavaScript.
let sessionDerivedKey: CryptoKey | null = null;
let sessionSalt: string | null = null; // base64 PBKDF2 salt from the stored HashedData

let _vaultUnlocked = false;
let _vaultUnlockExpiry: number | null = null;
// RAM-only storage for zkProofs (chain-specific)
let zkProofs: Partial<Record<SuiChain, ZkProofResponse | null>> = {
  "sui:devnet": null,
  "sui:testnet": null,
  "sui:mainnet": null,
};

/**
 * Checks if the vault unlock has expired and locks if necessary.
 * Returns true if the vault is locked (either was already locked or just locked due to expiry).
 */
function checkAndEnforceExpiry(): boolean {
  if (!ephemeralKey) {
    return true; // Already locked
  }

  if (_vaultUnlockExpiry && Date.now() > _vaultUnlockExpiry) {
    // Expiry reached - lock the vault
    ephemeralKey = null;
    sessionDerivedKey = null;
    sessionSalt = null;
    _vaultUnlocked = false;
    _vaultUnlockExpiry = null;
    void clearPersistedKeeperState();
    return true; // Now locked
  }

  return false; // Still unlocked
}

/**
 * Attempt to restore the ephemeral key and unlock state from
 * `chrome.storage.session`. This survives offscreen-document teardown
 * caused by Chromium MV3 service-worker eviction, so the user does not
 * have to re-enter their PIN every ~30 seconds of inactivity.
 *
 * Note: WebCrypto `sessionDerivedKey` is intentionally NOT restored —
 * key rotation will simply require a fresh unlock if the offscreen has
 * been torn down. This preserves the existing security boundary for
 * rotation while fixing the much more common signing-flow regression.
 */
async function restoreSessionStateIfAny(): Promise<void> {
  const restored = await restoreKeeperState();
  if (!restored) return;
  ephemeralKey = restored.ephemeralKey;
  _vaultUnlocked = true;
  _vaultUnlockExpiry = restored.unlockExpiry;
}

// Kick off restore as early as possible. Message handlers below await this
// promise before reading ephemeralKey, so signing requests that arrive
// during a cold-start race do not falsely fail with LOCKED.
const restorePromise: Promise<void> = restoreSessionStateIfAny();

/**
 * Message handler for keeper operations
 */
chrome.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
    // Only handle messages targeted to the keeper
    if (message.target !== "KEEPER") {
      return false;
    }

    if (message.type === KeeperMessageTypes.CREATE_KEYPAIR) {
      const { pin } = message;

      // Create a new keypair
      ephemeralKey = Ed25519Keypair.generate();
      _vaultUnlocked = true;
      _vaultUnlockExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes default

      // Persist to chrome.storage.session so we survive offscreen-document
      // teardown without forcing the user to re-unlock.
      void persistKeeperState(ephemeralKey, _vaultUnlockExpiry);

      // Keep sendResponse reference and handle async operation
      (async () => {
        try {
          const hashedSecretKey = await encrypt(
            ephemeralKey?.getSecretKey(),
            pin as string,
          );

          // At first-time setup, derive and cache the session key.
          const salt = Uint8Array.from(atob(hashedSecretKey.salt), (c) =>
            c.charCodeAt(0),
          );
          sessionDerivedKey = await deriveAesKey(pin as string, salt, [
            "encrypt",
          ]);
          sessionSalt = hashedSecretKey.salt;

          const publicKeyBytes = Array.from(
            ephemeralKey?.getPublicKey().toRawBytes(),
          );

          sendResponse({
            ok: true,
            hashedSecretKey,
            publicKeyBytes,
          });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      })();

      return true; // Indicate async response - keeps port open
    }

    // Handle different keeper operations
    if (message.type === KeeperMessageTypes.UNLOCK_VAULT) {
      const { hashedSecretKey, pin } = message;

      // Decrypt the secret key
      (async () => {
        try {
          // Step 1: Decrypt
          let secretKey: string;
          try {
            secretKey = await decrypt(
              hashedSecretKey as HashedData,
              pin as string,
            );
          } catch (decryptError) {
            console.error("[Keeper] Decryption failed:", decryptError);
            sendResponse({
              ok: false,
              error: `[Keeper] Decryption failed: ${decryptError instanceof Error ? decryptError.message : "Unknown error"}`,
            });
            return;
          }

          // Step 2: Reconstruct keypair
          try {
            ephemeralKey = Ed25519Keypair.fromSecretKey(secretKey);
            _vaultUnlocked = true;
            _vaultUnlockExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes default

            // Persist to chrome.storage.session so we survive offscreen
            // document teardown.
            void persistKeeperState(ephemeralKey, _vaultUnlockExpiry);

            // At subsequent unlock attempts, derive and cache the session key
            // from the stored salt.
            const salt = Uint8Array.from(
              atob((hashedSecretKey as HashedData).salt),
              (c) => c.charCodeAt(0),
            );
            sessionDerivedKey = await deriveAesKey(pin as string, salt, [
              "encrypt",
            ]);
            sessionSalt = (hashedSecretKey as HashedData).salt;

            sendResponse({ ok: true });
          } catch (keypairError) {
            console.error("[Keeper] Keypair creation failed:", keypairError);
            sendResponse({
              ok: false,
              error: `[Keeper] Failed to create keypair: ${keypairError instanceof Error ? keypairError.message : "Unknown error"}`,
            });
            return;
          }
        } catch (error) {
          console.error("[Keeper] Unexpected error:", error);
          sendResponse({
            ok: false,
            error: `[Keeper] Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      })();

      return true; // Indicate async response - keeps port open
    }

    if (message.type === KeeperMessageTypes.GET_PUBLIC_KEY) {
      // Wait for any in-flight session restore so a cold-start signing
      // race does not falsely report LOCKED.
      (async () => {
        await restorePromise;
        if (checkAndEnforceExpiry()) {
          sendResponse({ error: "LOCKED" });
          return;
        }
        const publicKey = ephemeralKey?.getPublicKey();
        sendResponse({
          ok: true,
          publicKeyBytes: Array.from(publicKey?.toRawBytes() ?? []),
        });
      })();
      return true; // async response
    }

    if (message.type === KeeperMessageTypes.ROTATE_KEYPAIR) {
      if (checkAndEnforceExpiry() || !sessionDerivedKey || !sessionSalt) {
        sendResponse({
          ok: false,
          error: "Vault must be unlocked again before rotating keypair",
        });
        return false;
      }

      (async () => {
        try {
          const newKeypair = Ed25519Keypair.generate();
          const hashedSecretKey = await encryptWithKey(
            newKeypair.getSecretKey(),
            sessionDerivedKey,
            sessionSalt,
          );

          // Only swap the in-memory keypair after successful encryption
          ephemeralKey = newKeypair;
          _vaultUnlocked = true;
          _vaultUnlockExpiry = Date.now() + 10 * 60 * 1000;

          // Persist rotated keypair so the next offscreen revival sees
          // the new key, not the old one.
          void persistKeeperState(ephemeralKey, _vaultUnlockExpiry);

          sendResponse({
            ok: true,
            hashedSecretKey,
            publicKeyBytes: Array.from(
              ephemeralKey.getPublicKey().toRawBytes(),
            ),
          });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      })();

      return true;
    }

    if (message.type === KeeperMessageTypes.EPH_SIGN) {
      // Handle async signing — wait for session restore first so a
      // cold-start race does not falsely report LOCKED.
      (async () => {
        await restorePromise;

        if (checkAndEnforceExpiry()) {
          sendResponse({ error: "[KEEPER_EPH_SIGN] LOCKED" });
          return;
        }

        const key = ephemeralKey;
        if (!key) {
          sendResponse({ error: "[KEEPER_EPH_SIGN] LOCKED" });
          return;
        }

        try {
          const { msgBytes, scope, sui_address } = message;
          // msgBytes comes as an array from chrome.runtime.sendMessage
          const messageBytes = new Uint8Array(msgBytes as number[]);

          const ephSignature = await ephSign(
            messageBytes,
            scope as IntentScope,
            {
              sui_address: sui_address as string,
              ephemeralKeyPair: key,
            },
          );

          sendResponse({
            ok: true,
            bytes: ephSignature.bytes,
            userSignature: ephSignature.userSignature,
          });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      })();

      return true; // Indicate async response
    }

    if (message.type === KeeperMessageTypes.SET_ZKPROOF) {
      // Store zkProof for a specific chain (await session restore to avoid
      // cold-start race).
      const { chain, zkProof } = message;
      (async () => {
        await restorePromise;
        if (!ephemeralKey) {
          sendResponse({
            error: "[KEEPER_SET_ZKPROOF] No ephemeral key found, vault LOCKED",
          });
          return;
        }
        if (!chain) {
          sendResponse({ error: "Chain is required" });
          return;
        }
        zkProofs[chain as SuiChain] = zkProof as ZkProofResponse;
        sendResponse({ ok: true });
      })();
      return true;
    }

    if (message.type === KeeperMessageTypes.GET_ZKPROOF) {
      // Retrieve zkProof for a specific chain (await session restore to
      // avoid cold-start race).
      const { chain } = message;
      (async () => {
        await restorePromise;
        if (!ephemeralKey) {
          sendResponse({ error: "LOCKED" });
          return;
        }
        if (!chain) {
          sendResponse({ error: "Chain is required" });
          return;
        }
        const zkProof = zkProofs[chain as SuiChain] ?? null;
        sendResponse({ ok: true, zkProof });
      })();
      return true;
    }

    if (message.type === KeeperMessageTypes.CLEAR_EPHKEY) {
      // Lock the vault and clear the key and zkProofs
      ephemeralKey = null;
      sessionDerivedKey = null;
      sessionSalt = null;
      _vaultUnlocked = false;
      _vaultUnlockExpiry = null;
      void clearPersistedKeeperState();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === KeeperMessageTypes.CLEAR_ZKPROOF) {
      // Clear the zkProofs
      zkProofs = {
        "sui:devnet": null,
        "sui:testnet": null,
        "sui:mainnet": null,
      };
      sendResponse({ ok: true });
      return false;
    }

    // Localnet dev methods
    if (message.type === KeeperMessageTypes.LOCALNET_SET_KEYPAIR) {
      localnetSetKeypair(localnetState, message, sendResponse);
      return true;
    }

    if (message.type === KeeperMessageTypes.LOCALNET_GET_ADDRESS) {
      localnetGetAddress(localnetState, sendResponse);
      return false;
    }

    if (message.type === KeeperMessageTypes.LOCALNET_SIGN) {
      localnetSign(localnetState, message, sendResponse);
      return true;
    }

    // Unknown message type
    sendResponse({ error: "Unknown message type" });
    return false;
  },
);

// Log that keeper is ready
console.log("Keeper offscreen document initialized");

// Notify background script that keeper is ready
chrome.runtime.sendMessage({ type: KeeperMessageTypes.READY }).catch(() => {
  // Ignore errors if background script isn't listening
});
