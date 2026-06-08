import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APPROVAL_TIMEOUT_MS, waitForVaultMessage } from '../vaultMessages'

describe('waitForVaultMessage', () => {
  beforeEach(() => {
    vi.spyOn(window, 'postMessage').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('posts the outbound request and resolves the matching success response', async () => {
    const promise = waitForVaultMessage({
      id: 'request-1',
      successType: 'ok',
      errorType: 'error',
      outbound: { __to: 'Eve Vault', id: 'request-1' },
      mapSuccess: (message) => message.result as string,
      timeoutMessage: 'timed out',
    })

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          __from: 'Elsewhere',
          id: 'request-1',
          type: 'ok',
          result: 'ignored',
        },
      }),
    )
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          __from: 'Eve Vault',
          id: 'other-request',
          type: 'ok',
          result: 'ignored',
        },
      }),
    )
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          __from: 'Eve Vault',
          id: 'request-1',
          type: 'ok',
          result: 'signed',
        },
      }),
    )

    await expect(promise).resolves.toBe('signed')
    expect(window.postMessage).toHaveBeenCalledWith(
      { __to: 'Eve Vault', id: 'request-1' },
      '*',
    )
  })

  it('rejects the matching error response', async () => {
    const promise = waitForVaultMessage({
      id: 'request-2',
      successType: 'ok',
      errorType: 'error',
      outbound: { __to: 'Eve Vault', id: 'request-2' },
      mapSuccess: (message) => message,
      timeoutMessage: 'timed out',
    })

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          __from: 'Eve Vault',
          id: 'request-2',
          type: 'error',
          error: 'rejected',
        },
      }),
    )

    await expect(promise).rejects.toThrow('rejected')
  })

  it('uses the message from structured error responses', async () => {
    const promise = waitForVaultMessage({
      id: 'request-structured-error',
      successType: 'ok',
      errorType: 'error',
      outbound: { __to: 'Eve Vault', id: 'request-structured-error' },
      mapSuccess: (message) => message,
      timeoutMessage: 'timed out',
    })

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          __from: 'Eve Vault',
          id: 'request-structured-error',
          type: 'error',
          error: { message: 'structured rejection' },
        },
      }),
    )

    await expect(promise).rejects.toThrow('structured rejection')
  })

  it('uses a fallback message when error responses have no message', async () => {
    const promise = waitForVaultMessage({
      id: 'request-empty-error',
      successType: 'ok',
      errorType: 'error',
      outbound: { __to: 'Eve Vault', id: 'request-empty-error' },
      mapSuccess: (message) => message,
      timeoutMessage: 'timed out',
    })

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          __from: 'Eve Vault',
          id: 'request-empty-error',
          type: 'error',
          error: {},
        },
      }),
    )

    await expect(promise).rejects.toThrow('Request failed')
  })

  it('rejects when no matching response arrives before the timeout', async () => {
    vi.useFakeTimers()
    const promise = waitForVaultMessage({
      id: 'request-3',
      successType: 'ok',
      errorType: 'error',
      outbound: { __to: 'Eve Vault', id: 'request-3' },
      mapSuccess: (message) => message,
      timeoutMessage: 'approval timed out',
    })
    const expectation = expect(promise).rejects.toThrow('approval timed out')

    await vi.advanceTimersByTimeAsync(APPROVAL_TIMEOUT_MS)

    await expectation
  })
})
