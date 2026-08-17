import { KeeperMessageTypes } from '@evevault/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { browser } from 'wxt/browser'
import { ChromeOffscreenKeeperHost } from '@/lib/background/keeper/chromeOffscreenKeeperHost'
import { FirefoxKeeperHost } from '@/lib/background/keeper/firefoxKeeperHost'
import { selectKeeperHost } from '@/lib/background/keeper/keeperHost'

const OWN_ORIGIN = 'moz-extension://11111111-2222-3333-4444-555555555555'

// Only runtime.getURL is needed: FirefoxKeeperHost dispatches in-process and
// the reused router derives its own origin from getURL. No offscreen surface.
function stubBrowser(origin: string | undefined) {
  vi.stubGlobal('browser', {
    runtime: origin ? { getURL: (path: string) => `${origin}${path}` } : {},
  } as unknown as typeof browser)
}

beforeEach(() => {
  stubBrowser(OWN_ORIGIN)
})

afterEach(async () => {
  // Keeper RAM state is a module-level singleton; reset between tests.
  await new FirefoxKeeperHost().send({ type: KeeperMessageTypes.CLEAR_EPHKEY })
  vi.unstubAllGlobals()
})

describe('FirefoxKeeperHost.send', () => {
  it('dispatches in-process and resolves the keeper response', async () => {
    // A locked-state query proves the whole path: own-origin sender clears the
    // isExtensionSender guard, the KEEPER target routes, and the response returns.
    const res = await new FirefoxKeeperHost().send({
      type: KeeperMessageTypes.GET_UNLOCK_REMAINING,
    })

    expect(res).toEqual({ ok: true, remainingMs: 0 })
  })

  it('resolves the router error for an unknown message type', async () => {
    const res = await new FirefoxKeeperHost().send({ type: 'NONSENSE' })

    expect(res).toEqual({ error: 'Unknown message type' })
  })

  it('ignores the retries argument (no message port in-process)', async () => {
    const res = await new FirefoxKeeperHost().send(
      { type: KeeperMessageTypes.GET_UNLOCK_REMAINING },
      0,
    )

    expect(res).toEqual({ ok: true, remainingMs: 0 })
  })

  it('resolves undefined when no extension context is available (no getURL)', async () => {
    // Without getURL the own-origin sender is empty, so the guard rejects and no
    // reply is produced; the caller resolves undefined rather than hanging.
    stubBrowser(undefined)

    const res = await new FirefoxKeeperHost().send({
      type: KeeperMessageTypes.GET_UNLOCK_REMAINING,
    })

    expect(res).toBeUndefined()
  })
})

describe('FirefoxKeeperHost.ensureReady', () => {
  it('resolves without touching the (absent) offscreen API', async () => {
    // browser stub has no `offscreen`; a no-op ensureReady must not reach for it.
    await expect(
      new FirefoxKeeperHost().ensureReady(true),
    ).resolves.toBeUndefined()
  })
})

describe('selectKeeperHost', () => {
  it('picks the in-process host on Firefox', () => {
    expect(selectKeeperHost(true)).toBeInstanceOf(FirefoxKeeperHost)
  })

  it('picks the offscreen host on Chrome', () => {
    expect(selectKeeperHost(false)).toBeInstanceOf(ChromeOffscreenKeeperHost)
  })
})
