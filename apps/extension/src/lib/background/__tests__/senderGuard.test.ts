import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Browser } from 'wxt/browser'
import { isDappSender, isExtensionSender } from '@/lib/background/senderGuard'

type MsgSender = Browser.runtime.MessageSender

const CHROME_ID = 'abcdefghabcdefghabcdefghabcdefgh'
const FIREFOX_UUID = '11111111-2222-3333-4444-555555555555'

/**
 * Stub `browser.runtime.getURL` to model a given extension origin. Passing
 * `undefined` models a context where getURL is unavailable (the fallback path).
 */
function stubOwnOrigin(origin: string | undefined) {
  vi.stubGlobal('browser', {
    runtime: origin ? { getURL: (path: string) => `${origin}${path}` } : {},
  } as unknown as typeof browser)
}

function sender(overrides: Partial<MsgSender>): MsgSender {
  return overrides as MsgSender
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isExtensionSender', () => {
  describe('Chrome (chrome-extension://)', () => {
    const own = `chrome-extension://${CHROME_ID}`

    it('trusts a page URL under its own origin', () => {
      stubOwnOrigin(own)
      expect(isExtensionSender(sender({ url: `${own}/popup.html` }))).toBe(true)
    })

    it('trusts a bare origin equal to its own origin', () => {
      stubOwnOrigin(own)
      expect(isExtensionSender(sender({ origin: own }))).toBe(true)
    })

    it('trusts a match found on the tab URL', () => {
      stubOwnOrigin(own)
      expect(
        isExtensionSender(
          sender({
            origin: 'https://dapp.example',
            tab: { id: 3, url: `${own}/sign.html` } as Browser.tabs.Tab,
          }),
        ),
      ).toBe(true)
    })
  })

  describe('Firefox (moz-extension://)', () => {
    // Firefox's extension-URL host is a per-install UUID, not runtime.id — so
    // only a getURL-derived origin can match it.
    const own = `moz-extension://${FIREFOX_UUID}`

    it('trusts a page URL under its own moz-extension origin', () => {
      stubOwnOrigin(own)
      expect(isExtensionSender(sender({ url: `${own}/popup.html` }))).toBe(true)
    })

    it('trusts a bare moz-extension origin', () => {
      stubOwnOrigin(own)
      expect(isExtensionSender(sender({ origin: own }))).toBe(true)
    })
  })

  describe('fails closed', () => {
    const own = `chrome-extension://${CHROME_ID}`

    it('rejects a sender with no identifying metadata', () => {
      stubOwnOrigin(own)
      expect(isExtensionSender(sender({}))).toBe(false)
    })

    it('rejects a web (https) dApp sender', () => {
      stubOwnOrigin(own)
      expect(
        isExtensionSender(
          sender({
            origin: 'https://dapp.example',
            url: 'https://dapp.example/app',
          }),
        ),
      ).toBe(false)
    })

    it('rejects another extension with a different id', () => {
      stubOwnOrigin(own)
      expect(
        isExtensionSender(
          sender({ url: `chrome-extension://${'z'.repeat(32)}/popup.html` }),
        ),
      ).toBe(false)
    })

    it('rejects a lookalike host that prefix-matches its own id', () => {
      stubOwnOrigin(own)
      expect(
        isExtensionSender(sender({ url: `${own}-evil.example/popup.html` })),
      ).toBe(false)
    })

    it('rejects a moz-extension sender when running under Chrome', () => {
      stubOwnOrigin(own)
      expect(
        isExtensionSender(
          sender({ url: `moz-extension://${FIREFOX_UUID}/popup.html` }),
        ),
      ).toBe(false)
    })
  })

  describe('fallback when getURL is unavailable', () => {
    it('best-effort trusts a chrome-extension URL', () => {
      stubOwnOrigin(undefined)
      expect(
        isExtensionSender(sender({ url: 'chrome-extension://any/popup.html' })),
      ).toBe(true)
    })

    it('best-effort trusts a moz-extension URL', () => {
      stubOwnOrigin(undefined)
      expect(
        isExtensionSender(sender({ url: 'moz-extension://any/popup.html' })),
      ).toBe(true)
    })

    it('still rejects a web sender', () => {
      stubOwnOrigin(undefined)
      expect(
        isExtensionSender(sender({ url: 'https://dapp.example/app' })),
      ).toBe(false)
    })
  })
})

describe('isDappSender', () => {
  const own = `chrome-extension://${CHROME_ID}`

  it('trusts a web page tab sender', () => {
    stubOwnOrigin(own)
    expect(
      isDappSender(
        sender({
          origin: 'https://dapp.example',
          tab: { id: 42, url: 'https://dapp.example/app' } as Browser.tabs.Tab,
        }),
      ),
    ).toBe(true)
  })

  it('rejects a sender with no tab (e.g. background/extension page)', () => {
    stubOwnOrigin(own)
    expect(isDappSender(sender({ url: 'https://dapp.example/app' }))).toBe(
      false,
    )
  })

  it('rejects an extension UI tab so it cannot reach dApp-only routes', () => {
    stubOwnOrigin(own)
    expect(
      isDappSender(
        sender({
          origin: own,
          tab: { id: 7, url: `${own}/sign.html` } as Browser.tabs.Tab,
        }),
      ),
    ).toBe(false)
  })
})
