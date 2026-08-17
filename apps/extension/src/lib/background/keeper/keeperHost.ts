import { ChromeOffscreenKeeperHost } from './chromeOffscreenKeeperHost'
import { FirefoxKeeperHost } from './firefoxKeeperHost'

/**
 * Transport seam between the background script and the keeper (which holds the
 * ephemeral key in RAM). Chrome runs the keeper in an offscreen document;
 * Firefox — which has no offscreen API — will host it elsewhere behind this
 * same interface. Isolating the offscreen path here keeps that later change
 * additive and Firefox-gated.
 */
export interface KeeperHost {
  /**
   * Ensure the keeper is running. When `waitForReady` is true and the keeper is
   * being started, resolves once it signals readiness (subject to a timeout);
   * if the keeper is already running, resolves immediately.
   */
  ensureReady(waitForReady?: boolean): Promise<void>
  /**
   * Send a request to the keeper and return its response. Ensures the keeper is
   * ready first and retries transient "port closed" failures.
   */
  // biome-ignore lint/suspicious/noExplicitAny: keeper messages have dynamic types
  send(message: any, retries?: number): Promise<any>
}

// Chrome hosts the keeper in an offscreen document; Firefox — which has no
// offscreen API — runs it in-process in the background. Exported for tests;
// the singleton selects via the WXT build-time browser flag.
export function selectKeeperHost(isFirefox: boolean): KeeperHost {
  return isFirefox ? new FirefoxKeeperHost() : new ChromeOffscreenKeeperHost()
}

export const keeperHost: KeeperHost = selectKeeperHost(import.meta.env.FIREFOX)
