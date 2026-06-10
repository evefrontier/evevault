import type { DappRequestContext } from '@evevault/shared/types'
import { DAPP_PERMISSIONS_STORAGE_KEY } from '@evevault/shared/utils'
import type { SuiChain } from '@mysten/wallet-standard'

type DappPermissionRecord = DappRequestContext & {
  chains: SuiChain[]
  connectedAt: number
  updatedAt: number
}

type DappPermissionStore = Record<string, DappPermissionRecord>

export type DappPermissionResult =
  | { allowed: true; context: DappRequestContext }
  | { allowed: false; error: string; context?: DappRequestContext }

const ALLOWED_PAGE_PROTOCOLS = new Set(['http:', 'https:'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function normalizePageUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null

  try {
    const url = new URL(value)
    return ALLOWED_PAGE_PROTOCOLS.has(url.protocol) && url.origin !== 'null'
      ? url
      : null
  } catch {
    return null
  }
}

function getSenderUrl(
  sender: chrome.runtime.MessageSender,
): string | undefined {
  return sender.url ?? sender.tab?.url
}

export function getDappRequestContext(
  sender: chrome.runtime.MessageSender,
): DappRequestContext | null {
  const originUrl =
    normalizePageUrl(sender.origin) ??
    normalizePageUrl(sender.url) ??
    normalizePageUrl(sender.tab?.url)

  if (!originUrl) return null

  const senderUrl = normalizePageUrl(getSenderUrl(sender))

  return {
    origin: originUrl.origin,
    ...(senderUrl && { url: senderUrl.href }),
    ...(stringOrUndefined(sender.tab?.title) && { title: sender.tab?.title }),
    ...(stringOrUndefined(sender.tab?.favIconUrl) && {
      favIconUrl: sender.tab?.favIconUrl,
    }),
  }
}

function isSuiChainArray(value: unknown): value is SuiChain[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function toPermissionRecord(
  origin: string,
  value: unknown,
): DappPermissionRecord | null {
  if (!isRecord(value) || value.origin !== origin) return null
  if (
    typeof value.connectedAt !== 'number' ||
    typeof value.updatedAt !== 'number' ||
    !isSuiChainArray(value.chains)
  ) {
    return null
  }

  return {
    origin,
    chains: value.chains,
    connectedAt: value.connectedAt,
    updatedAt: value.updatedAt,
    ...(stringOrUndefined(value.url) && { url: value.url }),
    ...(stringOrUndefined(value.title) && { title: value.title }),
    ...(stringOrUndefined(value.favIconUrl) && {
      favIconUrl: value.favIconUrl,
    }),
  }
}

async function readPermissionStore(): Promise<DappPermissionStore> {
  const result = await chrome.storage.local.get(DAPP_PERMISSIONS_STORAGE_KEY)
  const raw = result[DAPP_PERMISSIONS_STORAGE_KEY]
  if (!isRecord(raw)) return {}

  const entries = Object.entries(raw).flatMap(([origin, value]) => {
    const record = toPermissionRecord(origin, value)
    return record ? [[origin, record] as const] : []
  })

  return Object.fromEntries(entries)
}

function mergeChains(
  chains: SuiChain[] | undefined,
  chain: SuiChain,
): SuiChain[] {
  return Array.from(new Set([...(chains ?? []), chain]))
}

function toRequestContext(record: DappPermissionRecord): DappRequestContext {
  return {
    origin: record.origin,
    connectedAt: record.connectedAt,
    ...(record.url && { url: record.url }),
    ...(record.title && { title: record.title }),
    ...(record.favIconUrl && { favIconUrl: record.favIconUrl }),
  }
}

export async function grantDappPermission(
  context: DappRequestContext,
  chain: SuiChain,
): Promise<DappRequestContext> {
  const permissions = await readPermissionStore()
  const existing = permissions[context.origin]
  const now = Date.now()
  const record: DappPermissionRecord = {
    origin: context.origin,
    connectedAt: existing?.connectedAt ?? now,
    updatedAt: now,
    chains: mergeChains(existing?.chains, chain),
    ...(context.url && { url: context.url }),
    ...(context.title && { title: context.title }),
    ...(context.favIconUrl && { favIconUrl: context.favIconUrl }),
  }

  await chrome.storage.local.set({
    [DAPP_PERMISSIONS_STORAGE_KEY]: {
      ...permissions,
      [context.origin]: record,
    },
  })

  return toRequestContext(record)
}

export async function requireDappPermission(
  sender: chrome.runtime.MessageSender,
  chain?: SuiChain,
): Promise<DappPermissionResult> {
  const context = getDappRequestContext(sender)
  if (!context) {
    return {
      allowed: false,
      error: 'Signing requests must come from a valid web page origin.',
    }
  }

  const permissions = await readPermissionStore()
  const permission = permissions[context.origin]
  if (!permission) {
    return {
      allowed: false,
      context,
      error: 'Connect this site to EVE Vault before requesting a signature.',
    }
  }

  if (chain && !permission.chains.includes(chain)) {
    return {
      allowed: false,
      context,
      error: 'Connect this site on the selected network before signing.',
    }
  }

  return {
    allowed: true,
    context: toRequestContext({
      ...permission,
      ...context,
    }),
  }
}
