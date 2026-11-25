import type { ExplorerId, ExplorerPreference } from '#/types/explorer'
import { isLocalnetChain } from '#/types/networks'

export const DEFAULT_EXPLORER: ExplorerPreference = { id: 'suiscan' }

export const BUILT_IN_EXPLORERS: ReadonlyArray<{
  id: Exclude<ExplorerId, 'custom'>
  name: string
  host: string
}> = [
  { id: 'suiscan', name: 'Suiscan', host: 'suiscan.xyz' },
  { id: 'suivision', name: 'SuiVision', host: 'suivision.xyz' },
]

const SUIVISION_HOSTS: Partial<Record<string, string>> = {
  mainnet: 'https://suivision.xyz',
  testnet: 'https://testnet.suivision.xyz',
}

export type ExplorerTemplateCheck =
  | { ok: true; host: string }
  | { ok: false; error: string }

/**
 * A custom template must be an https:// URL containing {digest}. {network} is
 * optional and becomes testnet, devnet or mainnet.
 */
export function checkExplorerTemplate(template: string): ExplorerTemplateCheck {
  const trimmed = template.trim()
  if (!trimmed.startsWith('https://')) {
    return { ok: false, error: 'Must start with https://' }
  }
  if (!trimmed.includes('{digest}')) {
    return { ok: false, error: 'Must include {digest}' }
  }
  try {
    const sample = trimmed
      .replace(/\{digest\}/g, 'digest')
      .replace(/\{network\}/g, 'testnet')
    return { ok: true, host: new URL(sample).hostname }
  } catch {
    return { ok: false, error: 'Not a valid URL' }
  }
}

function networkOf(chain: string): string {
  return chain.replace('sui:', '')
}

function suiscanUrl(
  chain: string,
  txDigest: string,
  localnetUrl?: string,
): string {
  if (isLocalnetChain(chain) && localnetUrl) {
    return `https://custom.suiscan.xyz/custom/tx/${txDigest}?network=${encodeURIComponent(localnetUrl)}`
  }
  return `https://suiscan.xyz/${networkOf(chain)}/tx/${txDigest}`
}

type ResolvedExplorer = { name: string; url: string }

/**
 * Picks the explorer that will actually open: the user's choice when it covers
 * the chain, otherwise Suiscan. Localnet always uses Suiscan's custom view.
 */
function resolveExplorer(
  chain: string,
  txDigest: string,
  explorer: ExplorerPreference = DEFAULT_EXPLORER,
  localnetUrl?: string,
): ResolvedExplorer {
  const fallback = {
    name: 'Suiscan',
    url: suiscanUrl(chain, txDigest, localnetUrl),
  }
  if (isLocalnetChain(chain)) return fallback

  if (explorer.id === 'suivision') {
    const base = SUIVISION_HOSTS[networkOf(chain)]
    if (!base) return fallback
    return { name: 'SuiVision', url: `${base}/txblock/${txDigest}` }
  }

  if (explorer.id === 'custom' && explorer.customTemplate) {
    const check = checkExplorerTemplate(explorer.customTemplate)
    if (!check.ok) return fallback
    const url = explorer.customTemplate
      .trim()
      .replace(/\{digest\}/g, encodeURIComponent(txDigest))
      .replace(/\{network\}/g, encodeURIComponent(networkOf(chain)))
    return { name: check.host, url }
  }

  return fallback
}

/** Transaction URL on the user's chosen explorer, falling back to Suiscan. */
export function getExplorerUrl(
  chain: string,
  txDigest: string,
  explorer?: ExplorerPreference,
  opts?: { localnetUrl?: string },
): string {
  return resolveExplorer(chain, txDigest, explorer, opts?.localnetUrl).url
}

/** Name for "View on {name}" links; matches the explorer getExplorerUrl opens. */
export function getExplorerName(
  chain: string,
  explorer?: ExplorerPreference,
): string {
  return resolveExplorer(chain, 'digest', explorer).name
}
