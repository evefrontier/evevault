import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChromeOffscreenKeeperHost } from '@/lib/background/keeper/chromeOffscreenKeeperHost'

// biome-ignore lint/suspicious/noExplicitAny: keeper messages/listeners are dynamic in tests
type Listener = (message: any) => void

function stubBrowser(
  opts: {
    hasDocument?: boolean
    sendMessage?: ReturnType<typeof vi.fn>
    createDocument?: ReturnType<typeof vi.fn>
  } = {},
) {
  const listeners: Listener[] = []
  const createDocument =
    opts.createDocument ?? vi.fn().mockResolvedValue(undefined)
  const hasDocument = vi.fn().mockResolvedValue(opts.hasDocument ?? true)
  const sendMessage =
    opts.sendMessage ?? vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('browser', {
    offscreen: { hasDocument, createDocument },
    runtime: {
      onMessage: { addListener: vi.fn((cb: Listener) => listeners.push(cb)) },
      sendMessage,
    },
    // biome-ignore lint/suspicious/noExplicitAny: partial browser stub
  } as any)
  return { listeners, createDocument, hasDocument, sendMessage }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('ChromeOffscreenKeeperHost.send', () => {
  it('tags the message with target: KEEPER and returns the response', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, value: 42 })
    stubBrowser({ hasDocument: true, sendMessage })

    const host = new ChromeOffscreenKeeperHost()
    const res = await host.send({ type: 'PING' })

    expect(res).toEqual({ ok: true, value: 42 })
    expect(sendMessage).toHaveBeenCalledWith({ type: 'PING', target: 'KEEPER' })
  })

  it('retries once on "port closed" then succeeds', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('The message port closed before a response'),
      )
      .mockResolvedValueOnce({ ok: true })
    stubBrowser({ hasDocument: true, sendMessage })

    const host = new ChromeOffscreenKeeperHost()
    const res = await host.send({ type: 'PING' })

    expect(res).toEqual({ ok: true })
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries on persistent "port closed"', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValue(new Error('The message port closed before a response'))
    stubBrowser({ hasDocument: true, sendMessage })

    const host = new ChromeOffscreenKeeperHost()
    await expect(host.send({ type: 'PING' }, 2)).rejects.toThrow('port closed')
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-transient errors', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('boom'))
    stubBrowser({ hasDocument: true, sendMessage })

    const host = new ChromeOffscreenKeeperHost()
    await expect(host.send({ type: 'PING' })).rejects.toThrow('boom')
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })
})

describe('ChromeOffscreenKeeperHost.ensureReady', () => {
  it('creates the offscreen document when none exists', async () => {
    const { createDocument } = stubBrowser({ hasDocument: false })

    const host = new ChromeOffscreenKeeperHost()
    await host.ensureReady(false)

    expect(createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'keeper.html' }),
    )
  })

  it('reuses an existing offscreen document (no creation)', async () => {
    const { createDocument } = stubBrowser({ hasDocument: true })

    const host = new ChromeOffscreenKeeperHost()
    await host.ensureReady(false)

    expect(createDocument).not.toHaveBeenCalled()
  })

  it('waits for the KEEPER_READY signal after creating the document', async () => {
    const { listeners, createDocument } = stubBrowser({ hasDocument: false })

    const host = new ChromeOffscreenKeeperHost()
    const ready = host.ensureReady(true)

    // Listener registers before createDocument so KEEPER_READY can't be missed.
    await vi.waitFor(() => expect(listeners).toHaveLength(1))
    expect(createDocument).toHaveBeenCalled()

    listeners[0]({ type: 'KEEPER_READY' })
    await expect(ready).resolves.toBeUndefined()
  })
})
