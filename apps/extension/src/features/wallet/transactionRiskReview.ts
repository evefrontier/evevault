import { isRecord } from '@evevault/shared/utils'

export type TransactionRiskSeverity = 'danger' | 'warning'

export type TransactionRiskFinding = {
  severity: TransactionRiskSeverity
  title: string
  detail: string
}

const COMMAND_RISK_RULES: Record<string, TransactionRiskFinding> = {
  publish: {
    severity: 'danger',
    title: 'Publishes Move code',
    detail: 'This can add new on-chain package code from your account.',
  },
  upgrade: {
    severity: 'danger',
    title: 'Upgrades Move code',
    detail: 'This can change package behavior controlled by your account.',
  },
  transferobjects: {
    severity: 'danger',
    title: 'Transfers objects',
    detail: 'This can move owned objects or tokens out of your account.',
  },
  movecall: {
    severity: 'warning',
    title: 'Calls Move code',
    detail: 'Review the package, module, and function before approving.',
  },
  makemovevec: {
    severity: 'warning',
    title: 'Builds object vectors',
    detail: 'This can pass multiple objects into a Move call.',
  },
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function dedupeFindings(
  findings: TransactionRiskFinding[],
): TransactionRiskFinding[] {
  const seen = new Set<string>()

  return findings.filter((finding) => {
    const key = `${finding.severity}:${finding.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Returns the array at `key` (top-level or nested under `data`), or undefined
// when the transaction has no such field at all. Distinguishing "absent" from
// "present but empty" lets reviewTransaction tell a recognizable transaction
// shape (empty `commands` is a genuine no-op) from an unrecognized payload.
function findTransactionArray(
  transaction: Record<string, unknown>,
  key: string,
): unknown[] | undefined {
  const value = transaction[key]
  if (Array.isArray(value)) return value

  const data = transaction.data
  if (isRecord(data) && Array.isArray(data[key])) return data[key]

  return undefined
}

function getCommandName(command: unknown): string | null {
  if (typeof command === 'string') return normalizeKey(command)
  if (!isRecord(command)) return null

  const explicitKind =
    typeof command.kind === 'string'
      ? command.kind
      : typeof command.type === 'string'
        ? command.type
        : null
  if (explicitKind) return normalizeKey(explicitKind)

  const commandKeys = Object.keys(command)
    .map(normalizeKey)
    .filter((key) => key in COMMAND_RISK_RULES)
  return commandKeys[0] ?? null
}

function reviewCommands(commands: unknown[]): TransactionRiskFinding[] {
  return commands.flatMap((command) => {
    const commandName = getCommandName(command)
    const finding = commandName ? COMMAND_RISK_RULES[commandName] : undefined
    return finding ? [finding] : []
  })
}

function hasSharedObjectInput(input: unknown): boolean {
  if (!isRecord(input)) return false

  const object = input.Object ?? input.object
  if (!isRecord(object)) return false

  return isRecord(object.SharedObject ?? object.sharedObject ?? object.Shared)
}

function reviewInputs(inputs: unknown[]): TransactionRiskFinding[] {
  return inputs.some(hasSharedObjectInput)
    ? [
        {
          severity: 'warning',
          title: 'Uses shared objects',
          detail:
            'Shared object calls can change state used by other accounts.',
        },
      ]
    : []
}

const UNVERIFIED_FINDING: TransactionRiskFinding = {
  severity: 'danger',
  title: 'Unverified transaction format',
  detail: 'The transaction payload could not be decoded for review.',
}

export function reviewTransaction(
  transaction: unknown,
): TransactionRiskFinding[] {
  if (!isRecord(transaction)) return [UNVERIFIED_FINDING]

  const commands = findTransactionArray(transaction, 'commands')
  const inputs = findTransactionArray(transaction, 'inputs')

  // A decoded object carrying neither a `commands` nor an `inputs` array is not
  // a transaction shape we know how to review (e.g. the SDK's JSON format
  // drifted, or the payload isn't a programmable transaction at all). Treat it
  // as unverified (danger) rather than silently "safe" — this is the fail-safe
  // that stops an unrecognized payload from bypassing the approval gate.
  if (commands === undefined && inputs === undefined) {
    return [UNVERIFIED_FINDING]
  }

  return dedupeFindings([
    ...reviewCommands(commands ?? []),
    ...reviewInputs(inputs ?? []),
  ])
}

/**
 * Whether the user must explicitly acknowledge before approving. True when any
 * finding is danger-class — including an undecodable payload, which is the
 * blind-signing case the approval gate exists to prevent.
 */
export function requiresAcknowledgement(
  findings: TransactionRiskFinding[],
): boolean {
  return findings.some((finding) => finding.severity === 'danger')
}
