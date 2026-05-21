import { useAuthStore } from '#/auth/stores/authStore'

export const useAuth = () => {
  const {
    user,
    login,
    extensionLogin,
    logout,
    setUser,
    loading,
    error,
    initialize,
  } = useAuthStore()

  return {
    user,
    loading,
    error,

    login,
    extensionLogin,
    logout,
    setUser,
    isAuthenticated: !!user,
    initialize,
  }
}
