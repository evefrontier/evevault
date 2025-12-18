import { useNetworkStore } from "../stores/networkStore";

export const useNetwork = () => {
  const { chain, loading, setChain } = useNetworkStore();

  return {
    chain,
    loading,
    setChain,
  };
};
