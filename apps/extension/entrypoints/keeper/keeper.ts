/// <reference types="chrome"/>

import {
  decrypt,
  encrypt,
  ephSign,
  type HashedData,
  KeeperMessageTypes,
  type ZkProofResponse,
} from "@evevault/shared";
import type { IntentScope } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { SuiChain } from "@mysten/wallet-standard";
import type { BackgroundMessage } from "../../src/lib/background/types";

/**
 * Keeper - Holds the ephemeral key in RAM-only memory
 * This offscreen document stays alive much longer than the service worker
 * and provides a stable place to store the decrypted ephemeral key.
 */

// RAM-only storage for the ephemeral key
let ephemeralKey: Ed25519Keypair | null = null;
let _vaultUnlocked = false;
let _vaultUnlockExpiry: number | null = null;
// RAM-only storage for zkProofs (chain-specific)
let zkProofs: Record<SuiChain, ZkProofResponse | null> = {
  "sui:devnet": null,
  "sui:testnet": null,
  "sui:localnet": null,
  "sui:mainnet": null,
};

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

      // Keep sendResponse reference and handle async operation
      (async () => {
        try {
          const hashedSecretKey = await encrypt(
            ephemeralKey?.getSecretKey(),
            pin as string,
          );

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
            console.log(
              "[Keeper] Decryption successful - secretKey type:",
              typeof secretKey,
            );
            console.log("[Keeper] secretKey length:", secretKey?.length);
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
            console.log(
              "[Keeper] Attempting to create keypair from secret key",
            );
            ephemeralKey = Ed25519Keypair.fromSecretKey(secretKey);
            console.log("[Keeper] Keypair created successfully");
            _vaultUnlocked = true;
            _vaultUnlockExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes default
            sendResponse({ ok: true });
          } catch (keypairError) {
            console.error("[Keeper] Keypair creation failed:", keypairError);
            console.error(
              "[Keeper] Secret key value (first 50 chars):",
              secretKey?.substring(0, 50),
            );
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
      // Return the ephemeral key if available
      if (!ephemeralKey) {
        sendResponse({ error: "LOCKED" });
        return false;
      }

      // Check if unlock has expired - fix variable name
      if (_vaultUnlockExpiry && Date.now() > _vaultUnlockExpiry) {
        ephemeralKey = null;
        _vaultUnlocked = false;
        _vaultUnlockExpiry = null;
        sendResponse({ error: "LOCKED" });
        return false;
      }

      const publicKey = ephemeralKey.getPublicKey();
      sendResponse({
        ok: true,
        publicKeyBytes: Array.from(publicKey.toRawBytes()),
      });
      return false;
    }

    if (message.type === KeeperMessageTypes.EPH_SIGN) {
      // Sign bytes with the ephemeral key (async operation)
      if (!ephemeralKey) {
        sendResponse({ error: "[KEEPER_EPH_SIGN] LOCKED" });
        return false;
      }

      // Check if unlock has expired
      // if (_vaultUnlockExpiry && Date.now() > _vaultUnlockExpiry) {
      //   ephemeralKey = null;
      //   _vaultUnlocked = false;
      //   _vaultUnlockExpiry = null;
      //   sendResponse({ error: "[KEEPER_EPH_SIGN] LOCKED" });
      //   return false;
      // }

      // Handle async signing
      (async () => {
        try {
          const { msgBytes, scope, sui_address } = message;
          // msgBytes comes as an array from chrome.runtime.sendMessage
          const messageBytes = new Uint8Array(msgBytes as number[]);

          const ephSignature = await ephSign(
            messageBytes,
            scope as IntentScope,
            {
              sui_address: sui_address as string,
              ephemeralKeyPair: ephemeralKey,
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
      // Store zkProof for a specific chain
      const { chain, zkProof } = message;

      if (!ephemeralKey) {
        sendResponse({
          error: "[KEEPER_SET_ZKPROOF] No ephemeral key found, vault LOCKED",
        });
        return false;
      }

      if (!chain) {
        sendResponse({ error: "Chain is required" });
        return false;
      }

      zkProofs[chain as SuiChain] = zkProof as ZkProofResponse;
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === KeeperMessageTypes.GET_ZKPROOF) {
      // Retrieve zkProof for a specific chain
      const { chain } = message;

      if (!ephemeralKey) {
        sendResponse({ error: "LOCKED" });
        return false;
      }

      if (!chain) {
        sendResponse({ error: "Chain is required" });
        return false;
      }

      const zkProof = zkProofs[chain as SuiChain] ?? null;
      sendResponse({
        ok: true,
        zkProof,
      });
      return false;
    }

    if (message.type === KeeperMessageTypes.CLEAR_EPHKEY) {
      // Lock the vault and clear the key and zkProofs
      ephemeralKey = null;
      _vaultUnlocked = false;
      _vaultUnlockExpiry = null;
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === KeeperMessageTypes.CLEAR_ZKPROOF) {
      // Clear the zkProofs
      zkProofs = {
        "sui:devnet": null,
        "sui:testnet": null,
        "sui:localnet": null,
        "sui:mainnet": null,
      };
      sendResponse({ ok: true });
      return false;
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
