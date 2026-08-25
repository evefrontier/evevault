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
// Any other shape is unrecognized: return undefined so the caller treats the
// simulation as unavailable rather than rendering an empty phantom success.
function getInner(result: SimulateResult) {
  if (result.$kind === 'Transaction') return result.Transaction
  if (result.$kind === 'FailedTransaction') return result.FailedTransaction
  return undefined
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
  if (change.idOperation === 'Deleted') return 'deleted'
  // A published package is `Created` + `PackageWrite`; check the output state
  // first so it is labeled `published` rather than a plain `created` object.
  if (change.outputState === 'PackageWrite') return 'published'
  if (change.idOperation === 'Created') return 'created'
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

function buildFailureSimulation({
  error,
  digest,
  effects,
  objectTypes,
  events,
}: {
  error: string
  digest?: string
  effects?: SuiClientTypes.TransactionEffects
  objectTypes?: Record<string, string>
  events?: SuiClientTypes.Event[]
}): TransactionSimulation {
  return {
    status: 'failure',
    error,
    digest: digest ?? '',
    gas: buildGas(effects?.gasUsed),
    balanceChanges: [],
    changedObjects: buildChangedObjects(effects, objectTypes),
    events: buildEvents(events),
  }
}

// Matches the failed simulate result `SimulationError` from `Transaction#build()`
// attaches as `.cause` (@mysten/sui `client/core-resolver.ts` `setGasBudget`).
function isFailedSimulationCause(cause: unknown): cause is {
  $kind: 'FailedTransaction'
  FailedTransaction: {
    effects?: SuiClientTypes.TransactionEffects
    digest?: string
    objectTypes?: Record<string, string>
    events?: SuiClientTypes.Event[]
  }
} {
  return (
    !!cause &&
    typeof cause === 'object' &&
    (cause as { $kind?: unknown }).$kind === 'FailedTransaction' &&
    'FailedTransaction' in cause
  )
}

// Reads the parsed `ExecutionError` a `SimulationError` carries on
// `.executionError`; survives bundling that drops `.cause`.
function extractExecutionError(err: Error): { message?: string } | undefined {
  const executionError = (err as { executionError?: unknown }).executionError
  return executionError && typeof executionError === 'object'
    ? (executionError as { message?: string })
    : undefined
}

// Canonical gRPC status names, matched against `RpcError.code` on the error's
// `.cause` — a string like `'UNAVAILABLE'` set from grpcweb's `GrpcStatusCode`.
// Hardcoded rather than imported: the names are gRPC-spec stable, and comparing
// strings keeps this decoupled from the transport library that produced them.
const TRANSIENT_RPC_CODES = new Set([
  'CANCELLED',
  'DEADLINE_EXCEEDED',
  'UNAVAILABLE',
  'ABORTED',
  'RESOURCE_EXHAUSTED',
])
const DETERMINISTIC_RPC_CODES = new Set([
  'INVALID_ARGUMENT',
  'FAILED_PRECONDITION',
  'OUT_OF_RANGE',
  'NOT_FOUND',
  'UNIMPLEMENTED',
  'PERMISSION_DENIED',
  'UNAUTHENTICATED',
])

// Retryable transport/contention failures — outcome unknown.
const TRANSIENT_MESSAGE =
  /tim ?e?out|timed out|unavailable|temporarily|overloaded|connection|failed to connect|fetch failed|requires a connection|reserved for another transaction|equivocated|\b(403|429|502|503|504)\b|-32050|-32604/i
// Failures the node reports before execution that the transaction cannot recover
// from as-is (gas/balance shortfalls, input validation, verification).
const DETERMINISTIC_MESSAGE =
  /insufficient|no valid gas coins|gas selection|could not automatically determine a budget|unusedvalue|vmverification|deserialization|move ?abort|transaction inputs|validator signing failed|invalid sui address|unresolved address|-32002/i

function rpcCode(cause: unknown): string | undefined {
  const code =
    cause && typeof cause === 'object'
      ? (cause as { code?: unknown }).code
      : undefined
  return typeof code === 'string' ? code : undefined
}

export function classifyBuildFailure(
  err: unknown,
): TransactionSimulation | null {
  if (!(err instanceof Error)) return null

  const executionError = extractExecutionError(err)

  // `.cause` carries full effects (gas, digest, changed objects).
  const cause = (err as Error & { cause?: unknown }).cause
  if (isFailedSimulationCause(cause)) {
    const inner = cause.FailedTransaction
    return buildFailureSimulation({
      error:
        inner.effects?.status.error?.message ??
        executionError?.message ??
        err.message,
      digest: inner.effects?.transactionDigest ?? inner.digest,
      effects: inner.effects,
      objectTypes: inner.objectTypes,
      events: inner.events,
    })
  }

  // `.cause` dropped; report the abort without effect detail.
  if (executionError) {
    return buildFailureSimulation({
      error: executionError.message ?? err.message,
    })
  }

  // Transient first, so an incidental substring can't label a retryable error
  // as a certain failure. Unrecognized errors fall through to unavailable.
  const code = rpcCode(cause)
  if (
    (code && TRANSIENT_RPC_CODES.has(code)) ||
    TRANSIENT_MESSAGE.test(err.message)
  ) {
    return null
  }
  if (
    (code && DETERMINISTIC_RPC_CODES.has(code)) ||
    DETERMINISTIC_MESSAGE.test(err.message)
  ) {
    return buildFailureSimulation({ error: err.message })
  }

  return null
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
  if (!inner) {
    throw new Error(`Unrecognized simulation response: ${result.$kind}`)
  }
  const effects = inner.effects
  const gas = buildGas(effects?.gasUsed)
  const digest = effects?.transactionDigest ?? inner.digest ?? ''
  const changedObjects = buildChangedObjects(effects, inner.objectTypes)
  const events = buildEvents(inner.events)

  if (effects?.status.success === false) {
    return buildFailureSimulation({
      error: effects.status.error?.message ?? 'Transaction would fail',
      digest,
      effects,
      objectTypes: inner.objectTypes,
      events: inner.events,
    })
  }

  const senderChanges = (inner.balanceChanges ?? []).filter(
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
