import { Text } from '@evevault/shared/components'
import Json from '@evevault/shared/components/Json'
import { formatAddress } from '@evevault/shared/utils'
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
  return <div className="flex flex-col gap-2">{children}</div>
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xsmall" color="grey-neutral">
      {children}
    </Text>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 items-baseline">
      <span className="text-[10px] uppercase text-(--grey-neutral)">
        {label}
      </span>
      <span className="text-xs leading-4 text-(--neutral) break-all">
        {value}
      </span>
    </div>
  )
}

function BalanceChangeRow({ change }: { change: SimulatedBalanceChange }) {
  const sign = change.isDebit ? '−' : '+'
  return (
    <Text
      size="small"
      variant="bold"
      color={change.isDebit ? 'neutral' : 'success'}
    >
      {sign}
      {change.amount} {change.symbol}
    </Text>
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
      <span className="text-[10px] uppercase text-(--grey-neutral)">
        {change.kind}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className="text-xs leading-4 text-(--neutral) truncate"
          title={`${change.objectId}${change.objectType ? `\n${change.objectType}` : ''}`}
        >
          {formatAddress(change.objectId, 6, 4)}
          {shortType ? ` · ${shortType}` : ''}
        </span>
        {owner && (
          <span className="text-[10px] leading-3 text-(--grey-neutral) truncate">
            {owner}
          </span>
        )}
      </div>
    </div>
  )
}

function EventRow({ event }: { event: SimulatedEvent }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-xs leading-4 text-(--neutral) truncate"
        title={event.type}
      >
        {event.label}
      </span>
      {event.json != null && (
        <Json
          value={JSON.stringify(event.json)}
          className="max-h-24 text-[10px]"
        />
      )}
    </div>
  )
}

function OutcomeBody({
  simulation,
  senderAddress,
}: {
  simulation: TransactionSimulation
  senderAddress?: string
}) {
  const failed = simulation.status === 'failure'
  return (
    <>
      <Text size="small" variant="bold" color={failed ? 'error' : 'success'}>
        {failed ? 'Expected to fail' : 'Expected to succeed'}
      </Text>
      {failed && simulation.error && (
        <Text size="xsmall" color="grey-neutral">
          {simulation.error}
        </Text>
      )}

      {simulation.digest && (
        <InfoRow label="Digest" value={simulation.digest} />
      )}
      <InfoRow label="Gas fee" value={`${simulation.gas.net} SUI`} />

      {!failed && (
        <div className="flex flex-col gap-1">
          <SectionLabel>Balance changes</SectionLabel>
          {simulation.balanceChanges.length === 0 ? (
            <Text size="small" color="neutral">
              None
            </Text>
          ) : (
            simulation.balanceChanges.map((change) => (
              <BalanceChangeRow
                key={`${change.coinType}:${change.isDebit}:${change.amount}`}
                change={change}
              />
            ))
          )}
        </div>
      )}

      {simulation.changedObjects.length > 0 && (
        <div className="flex flex-col gap-1">
          <SectionLabel>
            Changed objects ({simulation.changedObjects.length})
          </SectionLabel>
          {simulation.changedObjects.map((change) => (
            <ObjectChangeRow
              key={change.objectId}
              change={change}
              senderAddress={senderAddress}
            />
          ))}
        </div>
      )}

      {simulation.events.length > 0 && (
        <div className="flex flex-col gap-1">
          <SectionLabel>Events ({simulation.events.length})</SectionLabel>
          {simulation.events.map((event, i) => (
            <EventRow key={`${event.type}:${i}`} event={event} />
          ))}
        </div>
      )}
    </>
  )
}

export function TransactionSimulationPanel({
  state,
  senderAddress,
}: {
  state: SimulationState | null
  senderAddress?: string
}) {
  if (!state || state.status === 'loading') {
    return (
      <PanelShell>
        <Text size="small" color="grey-neutral">
          Simulating transaction…
        </Text>
      </PanelShell>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <PanelShell>
        <Text size="small" color="error">
          Could not simulate this transaction. Approve with caution.
        </Text>
        {state.reason && (
          <Text size="xsmall" color="grey-neutral">
            {state.reason}
          </Text>
        )}
      </PanelShell>
    )
  }

  return (
    <PanelShell>
      <OutcomeBody
        simulation={state.simulation}
        senderAddress={senderAddress}
      />
    </PanelShell>
  )
}
