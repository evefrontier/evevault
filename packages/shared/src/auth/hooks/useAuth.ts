import { useAuthStore } from "../stores/authStore";

export const useAuth = () => {
  const {
    user,
    login,
    extensionLogin,
    logout,
    setUser,
    loading,
    error,
    refreshJwt,
    initialize,
  } = useAuthStore();

  return {
    user,
    loading,
    error,

    login,
    extensionLogin,
    logout,
    setUser,
    refreshJwt,
    isAuthenticated: !!user,
    initialize,
  };
};
