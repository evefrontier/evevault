let onLockCallback: (() => void) | null = null;

export function registerOnLock(callback: (() => void) | null): void {
  onLockCallback = callback;
}

export function getOnLockCallback(): (() => void) | null {
  return onLockCallback;
}
