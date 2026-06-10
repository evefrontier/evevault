import { TenantId } from '@evefrontier/wallet-core/definitions'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { oidcMocks, logMocks, envMocks, configMocks, storeMocks } = vi.hoisted(
  () => {
    const userManagerConstructor = vi.fn()
    const addSilentRenewError = vi.fn()
    const addUserLoaded = vi.fn()
    const addUserUnloaded = vi.fn()
    const addAccessTokenExpired = vi.fn()
    const logError = vi.fn()
    const logWarn = vi.fn()
    const logInfo = vi.fn()
    const isExtension = vi.fn(() => false)
    const isWeb = vi.fn(() => false)
    const getTenantConfig = vi.fn(() => ({
      clientId: 'client-id',
      serverUrl: 'https://issuer.example',
    }))
    const getCurrentTenantId = vi.fn(() => 'stillness')
    const setUser = vi.fn()

    return {
      oidcMocks: {
        userManagerConstructor,
        addSilentRenewError,
        addUserLoaded,
        addUserUnloaded,
        addAccessTokenExpired,
      },
      logMocks: { logError, logWarn, logInfo },
      envMocks: { isExtension, isWeb },
      configMocks: { getTenantConfig, getCurrentTenantId },
      storeMocks: { setUser },
    }
  },
)

vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: logMocks.logInfo,
    warn: logMocks.logWarn,
    error: logMocks.logError,
  }),
}))

vi.mock('oidc-client-ts', () => {
  class UserManager {
    constructor(settings: unknown) {
      oidcMocks.userManagerConstructor(settings)
    }
    events = {
      addUserLoaded: oidcMocks.addUserLoaded,
      addUserUnloaded: oidcMocks.addUserUnloaded,
      addSilentRenewError: oidcMocks.addSilentRenewError,
      addAccessTokenExpired: oidcMocks.addAccessTokenExpired,
    }
  }

  class WebStorageStateStore {}

  return {
    UserManager,
    WebStorageStateStore,
  }
})

vi.mock('#/utils/tenantConfig', () => ({
  getTenantConfig: () => configMocks.getTenantConfig(),
}))

vi.mock('#/stores/tenantStore', () => ({
  getCurrentTenantId: () => configMocks.getCurrentTenantId(),
}))

vi.mock('#/auth/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ setUser: storeMocks.setUser }) },
}))

vi.mock('#/utils/environment', () => ({
  isExtension: () => envMocks.isExtension(),
  isWeb: () => envMocks.isWeb(),
}))

describe('authConfig UserManager', () => {
  // Re-imported after vi.resetModules() in beforeEach so each test gets a fresh
  // module (and a fresh per-tenant UserManager cache).
  let getUserManager: typeof import('#/auth/authConfig')['getUserManager']

  beforeEach(async () => {
    vi.resetModules()
    envMocks.isExtension.mockReturnValue(false)
    envMocks.isWeb.mockReturnValue(false)
    configMocks.getTenantConfig.mockReturnValue({
      clientId: 'client-id',
      serverUrl: 'https://issuer.example',
    })
    configMocks.getCurrentTenantId.mockReturnValue('stillness')
    ;({ getUserManager } = await import('#/auth/authConfig'))
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete (globalThis as unknown as { chrome?: unknown }).chrome
  })

  it('caches the UserManager per tenant', async () => {
    const first = getUserManager(TenantId.STILLNESS)
    const second = getUserManager(TenantId.STILLNESS)

    expect(first).toBe(second)
    expect(oidcMocks.userManagerConstructor).toHaveBeenCalledOnce()
  })

  it('configures a sessionStorage userStore on web', async () => {
    getUserManager(TenantId.STILLNESS)

    const settings = oidcMocks.userManagerConstructor.mock.calls[0]?.[0] as {
      userStore?: unknown
    }
    expect(settings.userStore).toBeDefined()
  })

  it('omits the userStore override in the extension environment', async () => {
    envMocks.isExtension.mockReturnValue(true)
    ;(globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: { id: 'ext-id' },
    }
    getUserManager(TenantId.STILLNESS)

    const settings = oidcMocks.userManagerConstructor.mock.calls[0]?.[0] as {
      userStore?: unknown
      redirect_uri?: string
    }
    expect(settings.userStore).toBeUndefined()
    expect(settings.redirect_uri).toBe(
      'chrome-extension://ext-id/callback.html',
    )
  })

  it('forwards loaded and unloaded users to the auth store', async () => {
    getUserManager(TenantId.STILLNESS)

    // Capture the callbacks getUserManager registered with the UserManager's
    // events, so we can invoke them to simulate OIDC firing the events.
    const loadedHandler = oidcMocks.addUserLoaded.mock.calls[0]?.[0] as (
      user: unknown,
    ) => void
    const unloadedHandler = oidcMocks.addUserUnloaded.mock
      .calls[0]?.[0] as () => void

    // Handlers dynamically import the auth store; assert each after its import resolves.
    const user = { profile: { sub: 'user-123' } }
    loadedHandler(user)
    await vi.waitFor(() =>
      expect(storeMocks.setUser).toHaveBeenCalledWith(user),
    )

    unloadedHandler()
    await vi.waitFor(() =>
      expect(storeMocks.setUser).toHaveBeenCalledWith(null),
    )
  })

  it('warns when the access token has expired', async () => {
    getUserManager(TenantId.STILLNESS)

    const handler = oidcMocks.addAccessTokenExpired.mock
      .calls[0]?.[0] as () => void
    handler()

    expect(logMocks.logWarn).toHaveBeenCalledWith(
      'Access token has already expired.',
      expect.objectContaining({ tenantId: 'stillness' }),
    )
  })

  it('passes automaticSilentRenew to UserManager', async () => {
    getUserManager(TenantId.STILLNESS)

    expect(oidcMocks.userManagerConstructor).toHaveBeenCalledOnce()
    const settings = oidcMocks.userManagerConstructor.mock.calls[0]?.[0] as {
      automaticSilentRenew?: boolean
    }

    expect(settings.automaticSilentRenew).toBe(true)
  })

  it('does not pass a client secret for public OAuth clients', async () => {
    getUserManager(TenantId.STILLNESS)

    const settings = oidcMocks.userManagerConstructor.mock.calls[0]?.[0] as {
      client_secret?: string
    }

    expect(settings.client_secret).toBeUndefined()
  })

  it('sets automaticSilentRenew to false in extension environment', async () => {
    envMocks.isExtension.mockReturnValue(true)
    ;(globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: { id: 'test-ext' },
    }
    try {
      getUserManager(TenantId.STILLNESS)

      const settings = oidcMocks.userManagerConstructor.mock.calls[0]?.[0] as {
        automaticSilentRenew?: boolean
      }
      expect(settings.automaticSilentRenew).toBe(false)
    } finally {
      delete (globalThis as unknown as { chrome?: unknown }).chrome
    }
  })

  it('logs when silent renew handler is invoked with an error', async () => {
    getUserManager(TenantId.STILLNESS)

    expect(oidcMocks.addSilentRenewError).toHaveBeenCalledOnce()
    const handler = oidcMocks.addSilentRenewError.mock.calls[0]?.[0] as
      | ((error: unknown) => void)
      | undefined
    expect(handler).toBeTypeOf('function')

    const fakeError = new Error('silent renew failed')
    handler?.(fakeError)

    expect(logMocks.logError).toHaveBeenCalledWith(
      'OIDC silent renew error',
      expect.objectContaining({
        tenantId: 'stillness',
        error: fakeError,
      }),
    )
  })
})

describe('redirectToFusionAuthLogout', () => {
  let originalLocation: Location

  beforeEach(() => {
    vi.resetModules()
    envMocks.isExtension.mockReturnValue(false)
    configMocks.getCurrentTenantId.mockReturnValue('stillness')
    configMocks.getTenantConfig.mockReturnValue({
      clientId: 'client-id',
      serverUrl: 'https://issuer.example/',
    })
    originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'https://app.test', href: '' },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
    vi.clearAllMocks()
  })

  it('redirects to the FusionAuth logout URL with client_id and redirect params', async () => {
    const { redirectToFusionAuthLogout } = await import('#/auth/authConfig')
    redirectToFusionAuthLogout()

    const url = new URL(window.location.href)
    // Trailing slash on serverUrl is stripped before appending the path.
    expect(url.origin + url.pathname).toBe(
      'https://issuer.example/oauth2/logout',
    )
    expect(url.searchParams.get('client_id')).toBe('client-id')
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe(
      'https://app.test',
    )
  })

  it('falls back to the app origin when FusionAuth config is missing', async () => {
    configMocks.getTenantConfig.mockReturnValue({ clientId: '', serverUrl: '' })

    const { redirectToFusionAuthLogout } = await import('#/auth/authConfig')
    redirectToFusionAuthLogout()

    expect(logMocks.logWarn).toHaveBeenCalledWith(
      expect.stringContaining('Missing FusionAuth config'),
    )
    expect(window.location.href).toBe('https://app.test')
  })

  it('uses chrome.identity launchWebAuthFlow in the extension environment', async () => {
    envMocks.isExtension.mockReturnValue(true)
    const launchWebAuthFlow = vi.fn()
    const sendMessage = vi.fn()
    ;(globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: { id: 'ext-id', sendMessage },
      identity: {
        getRedirectURL: () => 'https://ext-id.chromiumapp.org/',
        launchWebAuthFlow,
      },
    }

    try {
      const { redirectToFusionAuthLogout } = await import('#/auth/authConfig')
      redirectToFusionAuthLogout()

      expect(launchWebAuthFlow).toHaveBeenCalledOnce()
      const [opts, callback] = launchWebAuthFlow.mock.calls[0] as [
        { url: string; interactive: boolean },
        () => void,
      ]
      expect(opts.url).toContain('/oauth2/logout')
      expect(opts.interactive).toBe(true)

      // Invoking the callback broadcasts an empty-accounts change message.
      callback()
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'change' }),
      )
    } finally {
      delete (globalThis as unknown as { chrome?: unknown }).chrome
    }
  })
})
