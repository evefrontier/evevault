import { encrypt, type HashedData, KeeperMessageTypes } from "@evevault/shared";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { expect, vi } from "vitest";

export const TEST_PIN = "123456";

export type KeeperHandler = (
  message: Record<string, unknown>,
  sender: object,
  sendResponse: (response?: unknown) => void,
) => boolean | unknown;

/**
 * Creates test helpers that operate on the keeper message handler.
 *
 * Usage:
 *   const ctx = createKeeperTestContext();
 *   const { dispatch, rawDispatch, unlockVault } = ctx;
 *
 *   beforeAll(async () => {
 *     vi.stubGlobal("chrome", {
 *       runtime: {
 *         onMessage: { addListener: ctx.captureHandler },
 *         sendMessage: vi.fn().mockResolvedValue(undefined),
 *       },
 *     });
 *     await import("../keeper");
 *   });
 */
export function createKeeperTestContext(): {
  captureHandler: (fn: KeeperHandler) => void;
  dispatch: (msg: Record<string, unknown>) => Promise<Record<string, unknown>>;
  rawDispatch: (msg: Record<string, unknown>) => {
    returnValue: boolean | unknown;
    sendResponse: ReturnType<typeof vi.fn>;
  };
  unlockVault: () => Promise<{
    keypair: Ed25519Keypair;
    hashedSecretKey: HashedData;
  }>;
} {
  let handler!: KeeperHandler;

  function captureHandler(fn: KeeperHandler) {
    handler = fn;
  }

  /** Send a KEEPER-targeted message and await the sendResponse callback. */
  function dispatch(
    msg: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      handler({ target: "KEEPER", ...msg }, {}, (resp) =>
        resolve((resp ?? {}) as Record<string, unknown>),
      );
    });
  }

  /** Dispatch without the KEEPER target — used to test the routing guard. */
  function rawDispatch(msg: Record<string, unknown>): {
    returnValue: boolean | unknown;
    sendResponse: ReturnType<typeof vi.fn>;
  } {
    const sendResponse = vi.fn();
    const returnValue = handler(msg, {}, sendResponse);
    return { returnValue, sendResponse };
  }

  /** Unlock the vault with a freshly encrypted keypair. */
  async function unlockVault(): Promise<{
    keypair: Ed25519Keypair;
    hashedSecretKey: HashedData;
  }> {
    const keypair = Ed25519Keypair.generate();
    const hashedSecretKey = await encrypt(keypair.getSecretKey(), TEST_PIN);
    const resp = await dispatch({
      type: KeeperMessageTypes.UNLOCK_VAULT,
      hashedSecretKey,
      pin: TEST_PIN,
    });
    expect(resp.ok).toBe(true);
    return { keypair, hashedSecretKey };
  }

  return { captureHandler, dispatch, rawDispatch, unlockVault };
}
