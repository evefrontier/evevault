import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data doesn't change *every second*, but must stay fresh enough
      staleTime: 1000 * 15, // 15 seconds (chain state is time-sensitive)

      // Keep cache longer to avoid flicker when switching views
      gcTime: 1000 * 60 * 5, // 5 minutes

      // Startup performance: don't spam RPC when you open the extension popup
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false, // You manually control refetch in wallet context

      // Avoid retry storms if RPC nodes misbehave
      retry: (failureCount, error) => {
        // retry less aggressively for blockchain RPC failures
        if (error?.message?.includes("rate limit")) return false;
        return failureCount < 1; // retry ONCE
      },

      // Prevent stale data from causing UI hangs
      retryDelay: (attemptIndex) => Math.min(2000 * attemptIndex, 8000), // exponential but capped
    },

    mutations: {
      // Wallet mutations require fast feedback, don't retry blindly
      retry: 0,
    },
  },
});
