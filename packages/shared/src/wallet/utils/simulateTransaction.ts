import type { SuiClientTypes } from '@mysten/sui/client'
import type { SuiGraphQLClient } from '@mysten/sui/graphql'
import type { SuiGrpcClient } from '@mysten/sui/grpc'
import { SUI_COIN_TYPE } from '#/utils'
import { formatByDecimals, formatMistToSui } from '#/utils/format'
import { fetchCoinMetadata } from './coinMetadata'
import { extractSymbolFromCoinType } from './formatTransaction'

// Ask the fullnode for the full effect surface: net balance deltas, parsed
// effects (status, gas, changed objects, digest), the type of every changed
// object, and emitted events, so the approval popup can show what the
// transaction actually does.
const SIMULATE_INCLUDE = {
  effects: true,
  balanceChanges: true,
  objectTypes: true,
  events: true,
} as const

type SimulateResult = SuiClientTypes.SimulateTransactionResult<
  typeof SIMULATE_INCLUDE
>

export type SimulatedBalanceChange = {
  coinType: string
  symbol: string
  name?: string
  /** Formatted absolute amount, e.g. "12.5". */
  amount: string
  /** True when the account's balance of this coin decreases. */
  isDebit: boolean
}

export type ObjectChangeKind =
  | 'created'
  | 'mutated'
  | 'deleted'
  | 'published'
  | 'unknown'

export type SimulatedObjectChange = {
  objectId: string
  kind: ObjectChangeKind
  objectType?: string
  /**
   * Owner before/after, as display tokens: an address, `shared`, `immutable`,
   * or `object:0x…`. Only set when the transition is meaningful (a created
   * object's new owner, or a mutated object whose owner changed).
   */
  ownerBefore?: string
  ownerAfter?: string
}

export type SimulatedEvent = {
  /** Full Move type, e.g. `0xpkg::market::Sale`. */
  type: string
  /** `module::StructName`, for a compact label. */
  label: string
  /** Decoded Move struct data, when the node could render it. */
  json?: unknown
}

export type SimulatedGas = {
  /** All formatted in SUI. */
  computation: string
  storage: string
  rebate: string
  /** Net fee = computation + storage − rebate. */
  net: string
}

export type TransactionSimulation = {
  status: 'success' | 'failure'
  /** Set when the transaction would fail on-chain. */
  error?: string
  /** Projected transaction digest. */
  digest: string
  gas: SimulatedGas
  /** Net balance changes for the sender; the SUI line already reflects gas. */
  balanceChanges: SimulatedBalanceChange[]
  changedObjects: SimulatedObjectChange[]
  events: SimulatedEvent[]
}

// Both `Transaction` and `FailedTransaction` responses carry effects (a failed
// simulation still reports the gas it consumed), so read whichever is present.
function getInner(result: SimulateResult) {
  return result.$kind === 'Transaction'
    ? result.Transaction
    : result.FailedTransaction
}

function buildGas(
  gas: SuiClientTypes.GasCostSummary | undefined,
): SimulatedGas {
  const computation = BigInt(gas?.computationCost ?? '0')
  const storage = BigInt(gas?.storageCost ?? '0')
  const rebate = BigInt(gas?.storageRebate ?? '0')
  return {
    computation: formatMistToSui(computation),
    storage: formatMistToSui(storage),
    rebate: formatMistToSui(rebate),
    net: formatMistToSui(computation + storage - rebate),
  }
}

function objectChangeKind(
  change: SuiClientTypes.ChangedObject,
): ObjectChangeKind {
  if (change.idOperation === 'Created') return 'created'
  if (change.idOperation === 'Deleted') return 'deleted'
  if (change.outputState === 'PackageWrite') return 'published'
  if (change.outputState === 'ObjectWrite') return 'mutated'
  return 'unknown'
}

// Collapses an ObjectOwner into a single display token: an address, or one of
// the shorthand kinds. Returns undefined for unknown/absent owners.
function describeOwner(
  owner: SuiClientTypes.ObjectOwner | null | undefined,
): string | undefined {
  if (!owner) return undefined
  switch (owner.$kind) {
    case 'AddressOwner':
      return owner.AddressOwner
    case 'ObjectOwner':
      return `object:${owner.ObjectOwner}`
    case 'ConsensusAddressOwner':
      return owner.ConsensusAddressOwner.owner
    case 'Shared':
      return 'shared'
    case 'Immutable':
      return 'immutable'
    default:
      return undefined
  }
}

function buildChangedObjects(
  effects: SuiClientTypes.TransactionEffects | undefined,
  objectTypes: Record<string, string> | undefined,
): SimulatedObjectChange[] {
  return (effects?.changedObjects ?? []).map((change) => {
    const before = describeOwner(change.inputOwner)
    const after = describeOwner(change.outputOwner)
    // Only surface ownership when it tells a story: a brand-new owner, or a
    // change of hands. A mutation that leaves the owner untouched adds noise.
    const ownerChanged = change.idOperation === 'Created' || before !== after
    return {
      objectId: change.objectId,
      kind: objectChangeKind(change),
      objectType: objectTypes?.[change.objectId],
      ...(ownerChanged && before ? { ownerBefore: before } : {}),
      ...(ownerChanged && after ? { ownerAfter: after } : {}),
    }
  })
}

function buildEvents(
  events: SuiClientTypes.Event[] | undefined,
): SimulatedEvent[] {
  return (events ?? []).map((event) => {
    // eventType is `pkg::module::Name`; keep the readable `module::Name` tail.
    const label = event.eventType.split('::').slice(-2).join('::')
    return {
      type: event.eventType,
      label,
      ...(event.json != null ? { json: event.json } : {}),
    }
  })
}

async function enrichBalanceChanges(
  changes: SuiClientTypes.BalanceChange[],
  graphqlClient: SuiGraphQLClient,
): Promise<SimulatedBalanceChange[]> {
  const items: SimulatedBalanceChange[] = []
  for (const change of changes) {
    const amount = BigInt(change.amount)
    if (amount === 0n) continue

    const coinType = change.coinType || SUI_COIN_TYPE
    const metadata = await fetchCoinMetadata(graphqlClient, coinType)
    const decimals = metadata?.decimals ?? 9
    const abs = amount < 0n ? -amount : amount

    items.push({
      coinType,
      symbol: metadata?.symbol ?? extractSymbolFromCoinType(coinType),
      name: metadata?.name ?? undefined,
      amount: formatByDecimals(abs.toString(), decimals),
      isDebit: amount < 0n,
    })
  }
  return items
}

/**
 * Simulates already-built transaction bytes and shapes the fullnode response
 * into the projected effect on the sender's account. Throws on transport
 * failure so callers can distinguish "simulation unavailable" from "the
 * transaction would fail on-chain".
 */
export async function simulateTransactionOutcome({
  transactionBytes,
  sender,
  suiClient,
  graphqlClient,
}: {
  transactionBytes: Uint8Array
  sender: string
  suiClient: SuiGrpcClient
  graphqlClient: SuiGraphQLClient
}): Promise<TransactionSimulation> {
  const result = await suiClient.simulateTransaction({
    transaction: transactionBytes,
    include: SIMULATE_INCLUDE,
  })

  const inner = getInner(result)
  const effects = inner?.effects
  const gas = buildGas(effects?.gasUsed)
  const digest = effects?.transactionDigest ?? inner?.digest ?? ''
  const changedObjects = buildChangedObjects(effects, inner?.objectTypes)
  const events = buildEvents(inner?.events)

  if (effects?.status.success === false) {
    return {
      status: 'failure',
      error: effects.status.error?.message ?? 'Transaction would fail',
      digest,
      gas,
      balanceChanges: [],
      changedObjects,
      events,
    }
  }

  const senderChanges = (inner?.balanceChanges ?? []).filter(
    (bc) => bc.address.toLowerCase() === sender.toLowerCase(),
  )

  return {
    status: 'success',
    digest,
    gas,
    balanceChanges: await enrichBalanceChanges(senderChanges, graphqlClient),
    changedObjects,
    events,
  }
}
