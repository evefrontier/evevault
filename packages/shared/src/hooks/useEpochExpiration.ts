import { useEffect, useRef } from "react";
import { useAuth } from "../auth";
import { useDeviceStore } from "../stores/deviceStore";
import { useNetworkStore } from "../stores/networkStore";
import { createLogger } from "../utils/logger";

const log = createLogger();

/**
 * Hook that monitors maxEpochTimestampMs and automatically logs out when it expires.
 * Polling increases frequency as expiration approaches.
 */
export function useEpochExpiration() {
  const { logout, user } = useAuth();
  const { chain } = useNetworkStore();
  const getMaxEpochTimestampMs = useDeviceStore(
    (state) => state.getMaxEpochTimestampMs,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const maxEpochTimestampMs = getMaxEpochTimestampMs(chain);
    if (!maxEpochTimestampMs) {
      log.debug("No maxEpochTimestampMs found, skipping expiration monitoring");
      return;
    }

    const checkExpiration = () => {
      const now = Date.now();
      if (now >= maxEpochTimestampMs && !!user) {
        log.info("Max epoch expired, logging out", {
          expiredAt: maxEpochTimestampMs,
          currentTime: now,
        });
        logout();
        return;
      }
    };

    const getInterval = () => {
      const timeUntilExpiry = maxEpochTimestampMs - Date.now();
      // Check every 30 seconds when < 1 hour until expiration
      // Check every 5 minutes when > 1 hour until expiration
      return timeUntilExpiry < 60 * 60 * 1000 ? 30 * 1000 : 5 * 60 * 1000;
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
  }, [chain, getMaxEpochTimestampMs, logout, user]);
}
