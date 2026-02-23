/**
 * Performs one-time cleanup for a message-based approval flow: marks state as settled,
 * optionally clears the timeout, and removes the message listener.
 * Returns true if this call performed cleanup (first to settle); false if already settled.
 */
export function trySettle(
  state: { settled: boolean },
  listener: (e: MessageEvent) => void,
  timeoutId?: ReturnType<typeof setTimeout>,
  target: EventTarget = window,
): boolean {
  if (state.settled) return false;
  state.settled = true;
  if (timeoutId !== undefined) clearTimeout(timeoutId);
  target.removeEventListener("message", listener as EventListener);
  return true;
}
