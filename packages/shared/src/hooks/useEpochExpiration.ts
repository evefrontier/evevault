import { useEffect, useRef } from "react";
import { useAuth } from "../auth";
import { useDeviceStore } from "../stores/deviceStore";
import { useNetworkStore } from "../stores/networkStore";
import { createLogger } from "../utils/logger";

const log = createLogger();

/**
 * Hook that monitors maxEpochTimestampMs and refreshes JWT with new nonce
 * 3 seconds before epoch expiry. Falls back to logout if refresh fails.
 * Polling increases frequency as expiration approaches.
 */
export function useEpochExpiration() {
  const { logout, user, refreshJwt } = useAuth();
  const { chain } = useNetworkStore();
  const getMaxEpochTimestampMs = useDeviceStore(
    (state) => state.getMaxEpochTimestampMs,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    const maxEpochTimestampMs = getMaxEpochTimestampMs(chain);
    if (!maxEpochTimestampMs) {
      log.debug("No maxEpochTimestampMs found, skipping expiration monitoring");
      return;
    }

    const checkExpiration = async () => {
      const now = Date.now();
      const timeUntilExpiry = maxEpochTimestampMs - now;

      // Refresh 3 seconds before epoch expiry
      if (timeUntilExpiry <= 3000 && timeUntilExpiry > 0 && !!user) {
        // Prevent multiple simultaneous refresh attempts
        if (isRefreshingRef.current) {
          return;
        }

        log.info("Epoch expiring soon, refreshing JWT with new nonce", {
          expiresAt: maxEpochTimestampMs,
          timeUntilExpiry,
        });

        isRefreshingRef.current = true;
        try {
          await refreshJwt(chain);
          log.info("JWT refreshed successfully before epoch expiry");
        } catch (error) {
          log.error("Failed to refresh JWT before epoch expiry", error);
          // Fallback to logout if refresh fails
          logout();
        } finally {
          isRefreshingRef.current = false;
        }
        return;
      }

      // If already expired and no refresh happened, logout
      if (now >= maxEpochTimestampMs && !!user) {
        log.warn("Epoch expired, logging out");
        logout();
      }
    };

    const getInterval = () => {
      const timeUntilExpiry = maxEpochTimestampMs - Date.now();

      // More frequent polling as expiry approaches
      if (timeUntilExpiry < 10 * 1000) return 1000; // Every 1 second in final 10s
      if (timeUntilExpiry < 60 * 1000) return 5 * 1000; // Every 5 seconds in final minute
      if (timeUntilExpiry < 60 * 60 * 1000) return 30 * 1000; // Every 30s in final hour
      return 5 * 60 * 1000; // Every 5 minutes otherwise
    };

    // Check immediately on mount or chain change
    checkExpiration();

    const setupInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      const interval = getInterval();
      log.info("Setting up epoch expiration check", {
        chain,
        maxEpochTimestampMs,
        intervalMs: interval,
        timeUntilExpiry: maxEpochTimestampMs - Date.now(),
      });

      intervalRef.current = setInterval(() => {
        checkExpiration();
        // Adjust interval dynamically based on remaining time
        const newInterval = getInterval();
        if (newInterval !== interval) {
          setupInterval();
        }
      }, interval);
    };

    setupInterval();

    // Cleanup on unmount or chain change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [chain, getMaxEpochTimestampMs, user, refreshJwt, logout]);
}
