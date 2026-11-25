import { DirectionIcon, Text } from '@evevault/shared/components'
import Json from '@evevault/shared/components/Json'
import { formatAddress, formatDisplayAmount } from '@evevault/shared/utils'
import type {
  SimulatedBalanceChange,
  SimulatedEvent,
  SimulatedObjectChange,
  TransactionSimulation,
} from '@evevault/shared/wallet'
import type { SimulationState } from '@/features/wallet/hooks'

// The tab that hosts this content supplies the border and heading, so the
// panel itself is just a vertical stack.
function PanelShell({ children }: { children: React.ReactNode }) {
  return <div className="sim-outcome">{children}</div>
}

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="sim-outcome__section">
      <span className="c-eyebrow">{label}</span>
      {children}
    </div>
  )
}

function BalanceChangeRow({ change }: { change: SimulatedBalanceChange }) {
  const sign = change.isDebit ? '−' : '+'
  return (
    <li>
      <DirectionIcon
        out={change.isDebit}
        label={change.isDebit ? 'Out' : 'In'}
      />
      <span title={change.coinType}>
        {change.symbol}
        {change.name && change.name !== change.symbol && (
          <span className="sim-outcome__muted"> · {change.name}</span>
        )}
      </span>
      <span
        className={`sim-outcome__amount${change.isDebit ? '' : ' sim-outcome__amount--in'}`}
      >
        {sign}
        {formatDisplayAmount(change.amount, 9)}
      </span>
    </li>
  )
}

// Turns an owner display token (address | shared | immutable | object:0x…)
// into a short label, showing "you" for the signing account.
function formatOwner(
  token: string | undefined,
  senderAddress?: string,
): string | undefined {
  if (!token) return undefined
  if (token === 'shared' || token === 'immutable') return token
  if (token.startsWith('object:')) {
    return `object ${formatAddress(token.slice('object:'.length), 6, 4)}`
  }
  if (senderAddress && token.toLowerCase() === senderAddress.toLowerCase()) {
    return 'you'
  }
  return formatAddress(token, 6, 4)
}

function ownerTransition(
  change: SimulatedObjectChange,
  senderAddress?: string,
): string | undefined {
  const before = formatOwner(change.ownerBefore, senderAddress)
  const after = formatOwner(change.ownerAfter, senderAddress)
  if (before && after) return `${before} → ${after}`
  if (after) return `owner: ${after}`
  return undefined
}

// Renders "0x12ab… · struct" plus, when meaningful, the ownership transition.
function ObjectChangeRow({
  change,
  senderAddress,
}: {
  change: SimulatedObjectChange
  senderAddress?: string
}) {
  const shortType = change.objectType?.split('::').pop()
  const owner = ownerTransition(change, senderAddress)
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-2 items-baseline">
      <span className="c-label">{change.kind}</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className="text-xs leading-4 text-(--ink) tabular-nums truncate"
          title={`${change.objectId}${change.objectType ? `\n${change.objectType}` : ''}`}
        >
          {formatAddress(change.objectId, 6, 4)}
          {shortType ? ` · ${shortType}` : ''}
        </span>
        {owner && (
          <span className="text-[10px] leading-3 text-(--n50) truncate">
            {owner}
          </span>
        )}
      </div>
    </div>
  )
}

// Decoded Move struct data can contain bigints (u64/u128) that plain
// JSON.stringify throws on; coerce them to strings and swallow any residual
// serialization failure so one odd event can't crash the whole panel.
function safeJson(value: unknown): string | null {
  try {
    return JSON.stringify(value, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    )
  } catch {
    return null
  }
}

function EventRow({ event }: { event: SimulatedEvent }) {
  const json = event.json != null ? safeJson(event.json) : null
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-xs leading-4 text-(--ink) tabular-nums truncate"
        title={event.type}
      >
        {event.label}
      </span>
      {json && <Json value={json} className="max-h-24 text-[10px]" />}
    </div>
  )
}

function OutcomeBody({
  simulation,
  senderAddress,
  gasPaidBySponsor,
}: {
  simulation: TransactionSimulation
  senderAddress?: string
  gasPaidBySponsor?: boolean
}) {
  const failed = simulation.status === 'failure'
  return (
    <>
      {!failed && (
        <Section label="Balance changes">
          {simulation.balanceChanges.length === 0 ? (
            <Text size="small" color="n60">
              None
            </Text>
          ) : (
            <ul className="c-rows">
              {simulation.balanceChanges.map((change) => (
                <BalanceChangeRow
                  key={`${change.coinType}:${change.isDebit}:${change.amount}`}
                  change={change}
                />
              ))}
            </ul>
          )}
        </Section>
      )}

      <dl className="c-kv">
        <dt>Gas fee</dt>
        <dd>
          {formatDisplayAmount(simulation.gas.net, 9)} SUI
          {gasPaidBySponsor ? ' · paid by sponsor' : ''}
        </dd>
        <dt>Simulation</dt>
        <dd className={failed ? 'sim-outcome__fail' : 'sim-outcome__ok'}>
          {failed ? 'Expected to fail' : 'Expected to succeed'}
        </dd>
        {simulation.digest && (
          <>
            <dt>Digest</dt>
            <dd title={simulation.digest}>
              {formatAddress(simulation.digest, 8, 8)}
            </dd>
          </>
        )}
      </dl>
      {failed && simulation.error && (
        <div className="c-banner c-banner--red">
          <Text size="xsmall" color="n60">
            {simulation.error}
          </Text>
        </div>
      )}

      {simulation.changedObjects.length > 0 && (
        <Section
          label={`Changed objects (${simulation.changedObjects.length})`}
        >
          {simulation.changedObjects.map((change) => (
            <ObjectChangeRow
              key={change.objectId}
              change={change}
              senderAddress={senderAddress}
            />
          ))}
        </Section>
      )}

      {simulation.events.length > 0 && (
        <Section label={`Events (${simulation.events.length})`}>
          {simulation.events.map((event, i) => (
            <EventRow key={`${event.type}:${i}`} event={event} />
          ))}
        </Section>
      )}
    </>
  )
}

export function TransactionSimulationPanel({
  state,
  senderAddress,
  gasPaidBySponsor,
}: {
  state: SimulationState | null
  senderAddress?: string
  gasPaidBySponsor?: boolean
}) {
  if (!state || state.status === 'loading') {
    return (
      <PanelShell>
        <Text size="small" color="n60">
          Simulating transaction…
        </Text>
      </PanelShell>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <PanelShell>
        <div className="c-banner c-banner--amber">
          <Text size="small" color="neutral">
            Could not simulate this transaction. Approve with caution.
          </Text>
          {state.reason && (
            <Text size="xsmall" color="n60">
              {state.reason}
            </Text>
          )}
        </div>
      </PanelShell>
    )
  }

  return (
    <PanelShell>
      <OutcomeBody
        simulation={state.simulation}
        senderAddress={senderAddress}
        gasPaidBySponsor={gasPaidBySponsor}
      />
    </PanelShell>
  )
}
