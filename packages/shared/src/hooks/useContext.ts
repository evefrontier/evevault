import { useContextStore } from '#/stores/contextStore'

export const useContext = () => {
  const {
    tenantId,
    devMode,
    setDevMode,
    chain,
    loading,
    checkNetworkSwitch,
    forceSetChain,
    setChain,
  } = useContextStore()

  return {
    tenantId,
    devMode,
    setDevMode,
    chain,
    loading,
    checkNetworkSwitch,
    forceSetChain,
    setChain,
  }
}
