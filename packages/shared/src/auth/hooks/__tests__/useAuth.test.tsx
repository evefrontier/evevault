import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLogin,
  mockLogout,
  mockExtensionLogin,
  mockSetUser,
  mockInitialize,
  mockUseAuthStore,
} = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockLogout: vi.fn(),
  mockExtensionLogin: vi.fn(),
  mockSetUser: vi.fn(),
  mockInitialize: vi.fn(),
  mockUseAuthStore: vi.fn(),
}))

vi.mock('#/auth/stores/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}))

import { useAuth } from '#/auth/hooks/useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuthStore.mockReturnValue({
      user: null,
      loading: false,
      error: null,
      login: mockLogin,
      logout: mockLogout,
      extensionLogin: mockExtensionLogin,
      setUser: mockSetUser,
      initialize: mockInitialize,
    })
  })

  it('sets isAuthenticated to true when user is non-null', () => {
    mockUseAuthStore.mockReturnValue({
      user: { id_token: 'token' },
      loading: false,
      error: null,
      login: mockLogin,
      logout: mockLogout,
      extensionLogin: mockExtensionLogin,
      setUser: mockSetUser,
      initialize: mockInitialize,
    })

    const { result } = renderHook(() => useAuth())

    expect(result.current.isAuthenticated).toBe(true)
  })

  it('sets isAuthenticated to false when user is null', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.isAuthenticated).toBe(false)
  })

  it('exposes the auth store public API', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.login).toBe(mockLogin)
    expect(result.current.logout).toBe(mockLogout)
    expect(result.current.extensionLogin).toBe(mockExtensionLogin)
    expect(result.current.setUser).toBe(mockSetUser)
    expect(result.current.initialize).toBe(mockInitialize)
  })
})
