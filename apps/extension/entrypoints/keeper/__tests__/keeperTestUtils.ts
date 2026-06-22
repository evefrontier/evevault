import { ZKEd25519Keypair } from '@evefrontier/wallet-core/crypto'
import { encrypt, type HashedData, KeeperMessageTypes } from '@evevault/shared'
import { afterEach, beforeAll, expect, vi } from 'vitest'

export const TEST_PIN = '123456'

export type KeeperHandler = (
  message: Record<string, unknown>,
  sender: object,
  sendResponse: (response?: unknown) => void,
) => boolean | unknown

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
  captureHandler: (fn: KeeperHandler) => void
  dispatch: (msg: Record<string, unknown>) => Promise<Record<string, unknown>>
  rawDispatch: (msg: Record<string, unknown>) => {
    returnValue: boolean | unknown
    sendResponse: ReturnType<typeof vi.fn>
  }
  unlockVault: () => Promise<{
    keypair: ZKEd25519Keypair
    hashedSecretKey: HashedData
  }>
} {
  let handler!: KeeperHandler

  function captureHandler(fn: KeeperHandler) {
    handler = fn
  }

  /** Send a KEEPER-targeted message and await the sendResponse callback. */
  function dispatch(
    msg: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      handler(
        { target: 'KEEPER', ...msg },
        { url: 'chrome-extension://test-extension-id/offscreen.html' },
        (resp) => resolve((resp ?? {}) as Record<string, unknown>),
      )
    })
  }

  /** Dispatch without the KEEPER target — used to test the routing guard. */
  function rawDispatch(msg: Record<string, unknown>): {
    returnValue: boolean | unknown
    sendResponse: ReturnType<typeof vi.fn>
  } {
    const sendResponse = vi.fn()
    const returnValue = handler(msg, {}, sendResponse)
    return { returnValue, sendResponse }
  }

  /** Unlock the vault with a freshly encrypted keypair. */
  async function unlockVault(): Promise<{
    keypair: ZKEd25519Keypair
    hashedSecretKey: HashedData
  }> {
    const keypair = ZKEd25519Keypair.generate()
    const hashedSecretKey = await encrypt(keypair.getSecretKey(), TEST_PIN)
    const resp = await dispatch({
      type: KeeperMessageTypes.UNLOCK_VAULT,
      hashedSecretKey,
      pin: TEST_PIN,
    })
    expect(resp.ok).toBe(true)
    return { keypair, hashedSecretKey }
  }

  return { captureHandler, dispatch, rawDispatch, unlockVault }
}

/**
 * Registers the shared beforeAll/afterEach hooks for a keeper test file.
 * Call this at the top level of any file that tests keeper message handling.
 *
 * - beforeAll: stubs the chrome global and loads keeper.ts so it registers
 *   its runtime.onMessage listener with the captured handler.
 * - afterEach: clears ephemeral key + zkProofs and resets all mocks so tests
 *   don't bleed into each other.
 */
export function setupKeeperSuite(
  ctx: ReturnType<typeof createKeeperTestContext>,
) {
  beforeAll(async () => {
    // chrome must exist before keeper.ts loads because it calls
    // chrome.runtime.onMessage.addListener() at module scope.
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'test-extension-id',
        onMessage: { addListener: ctx.captureHandler },
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    })
    // Dynamic import so the chrome stub is in place when the module registers
    // its listener. This exercises the real message-handler registration.
    await import('../keeper')
  })

  afterEach(async () => {
    vi.useRealTimers()
    // Reset keeper's RAM state so tests don't bleed into each other.
    await ctx.dispatch({ type: KeeperMessageTypes.CLEAR_EPHKEY })
    await ctx.dispatch({ type: KeeperMessageTypes.CLEAR_ZKPROOF })
    vi.clearAllMocks()
  })
}
