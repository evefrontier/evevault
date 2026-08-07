import { createLogger } from '@evevault/shared/utils'
import { browser } from 'wxt/browser'
import type { KeeperHost } from './keeperHost'

const log = createLogger()

/**
 * Chrome keeper host: the keeper lives in an offscreen document, reached by
 * broadcasting `runtime.sendMessage` with a `target: 'KEEPER'` tag. Relocated
 * verbatim from the former offscreenService + vaultHandlers.sendToKeeper; the
 * only intentional change is that the KEEPER_READY listener registers lazily
 * (just before the document is created) instead of at module load, so the host
 * has no import-time side effect.
 */
export class ChromeOffscreenKeeperHost implements KeeperHost {
  #ready = false
  #readyPromise: Promise<void> | undefined
  #listenerRegistered = false

  // Keeper signals readiness once its offscreen document has initialised.
  // Registered before createDocument so the KEEPER_READY message can't be missed.
  #registerReadyListener(): void {
    if (this.#listenerRegistered) {
      return
    }
    this.#listenerRegistered = true
    this.#readyPromise = new Promise((resolve) => {
      browser.runtime.onMessage.addListener((message) => {
        if (message.type === 'KEEPER_READY') {
          this.#ready = true
          resolve()
        }
        return false
      })
    })
  }

  async ensureReady(waitForReady = false): Promise<void> {
    try {
      const hasDoc = await browser.offscreen.hasDocument()
      if (!hasDoc) {
        this.#registerReadyListener()
        await browser.offscreen.createDocument({
          url: 'keeper.html',
          reasons: ['LOCAL_STORAGE', 'DOM_SCRAPING'],
          justification: 'Hold ephemeral key in RAM only.',
        })
        log.info('Keeper offscreen document created')

        if (waitForReady) {
          // Wait for keeper to signal it's ready (with timeout)
          await Promise.race([
            this.#readyPromise,
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Keeper initialization timeout')),
                2000,
              ),
            ),
          ])
        }
      } else {
        log.debug('Keeper offscreen document exists')

        if (waitForReady && !this.#ready) {
          this.#ready = true
        }
      }
    } catch (error) {
      log.error('Failed to ensure offscreen document', error)
      if (waitForReady) {
        throw error
      }
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: keeper messages have dynamic types
  async send(message: any, retries = 3): Promise<any> {
    await this.ensureReady(true)

    for (let attempt = 1; ; attempt++) {
      try {
        return await browser.runtime.sendMessage({
          ...message,
          target: 'KEEPER',
        })
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)

        // If port closed and we have retries left, wait and retry
        if (error?.includes('port closed') && attempt < retries) {
          log.info(
            `Keeper not ready yet, retrying... (attempt ${
              attempt + 1
            }/${retries})`,
          )
          await new Promise((r) => setTimeout(r, 200 * attempt)) // Exponential backoff
          continue
        }

        throw new Error(error)
      }
    }
  }
}
