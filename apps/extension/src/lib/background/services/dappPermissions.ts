import type { DappRequestContext } from '@evevault/shared/types'
import { DAPP_PERMISSIONS_STORAGE_KEY, isRecord } from '@evevault/shared/utils'
import { SUI_CHAINS, type SuiChain } from '@mysten/wallet-standard'
import { type Browser, browser } from 'wxt/browser'

type DappPermissionRecord = DappRequestContext & {
  chains: SuiChain[]
  connectedAt: number
  updatedAt: number
}

type DappPermissionStore = Record<string, DappPermissionRecord>
type PermissionStoreUpdate<T> = {
  store: DappPermissionStore
  result: T
}

export type DappPermissionResult =
  | { allowed: true; context: DappRequestContext }
  | { allowed: false; error: string; context?: DappRequestContext }

export type DappPermissionRevocationResult =
  | { ok: true; context: DappRequestContext; hadPermission: boolean }
  | { ok: false; error: string }

const ALLOWED_PAGE_PROTOCOLS = new Set(['http:', 'https:'])
let permissionStoreUpdateQueue: Promise<unknown> = Promise.resolve()

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
  sender: Browser.runtime.MessageSender,
): string | undefined {
  return sender.url ?? sender.tab?.url
}

export function getDappRequestContext(
  sender: Browser.runtime.MessageSender,
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

function isSuiChainValue(value: unknown): value is SuiChain {
  return typeof value === 'string' && SUI_CHAINS.includes(value as SuiChain)
}

function isSuiChainArray(value: unknown): value is SuiChain[] {
  return Array.isArray(value) && value.every(isSuiChainValue)
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

function sanitizePermissionStore(value: unknown): DappPermissionStore {
  if (!isRecord(value)) return {}

  const entries = Object.entries(value).flatMap(([origin, entry]) => {
    const record = toPermissionRecord(origin, entry)
    return record ? [[origin, record] as const] : []
  })

  return Object.fromEntries(entries)
}

async function readPermissionStore(): Promise<DappPermissionStore> {
  const result = await browser.storage.local.get(DAPP_PERMISSIONS_STORAGE_KEY)
  return sanitizePermissionStore(result[DAPP_PERMISSIONS_STORAGE_KEY])
}

async function updatePermissionStore<T>(
  update: (permissions: DappPermissionStore) => PermissionStoreUpdate<T>,
): Promise<T> {
  const nextUpdate = permissionStoreUpdateQueue.then(async () => {
    const permissions = await readPermissionStore()
    const { store, result } = update(permissions)
    await browser.storage.local.set({ [DAPP_PERMISSIONS_STORAGE_KEY]: store })
    return result
  })

  permissionStoreUpdateQueue = nextUpdate.catch(() => undefined)
  return nextUpdate
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
  return updatePermissionStore((permissions) => {
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

    return {
      store: {
        ...permissions,
        [context.origin]: record,
      },
      result: toRequestContext(record),
    }
  })
}

export async function requireDappPermission(
  sender: Browser.runtime.MessageSender,
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

export async function revokeDappPermission(
  sender: Browser.runtime.MessageSender,
): Promise<DappPermissionRevocationResult> {
  const context = getDappRequestContext(sender)
  if (!context) {
    return {
      ok: false,
      error: 'Disconnect requests must come from a valid web page origin.',
    }
  }

  return updatePermissionStore((permissions) => {
    const hadPermission = Boolean(permissions[context.origin])
    if (!hadPermission) {
      return {
        store: permissions,
        result: { ok: true, context, hadPermission: false },
      }
    }

    const { [context.origin]: _removed, ...remainingPermissions } = permissions
    return {
      store: remainingPermissions,
      result: { ok: true, context, hadPermission: true },
    }
  })
}
