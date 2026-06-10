export type TransactionRiskSeverity = 'danger' | 'warning'

export type TransactionRiskFinding = {
  severity: TransactionRiskSeverity
  title: string
  detail: string
}

type RiskRule = TransactionRiskFinding & {
  key: string
}

const COMMAND_RISK_RULES: RiskRule[] = [
  {
    key: 'publish',
    severity: 'danger',
    title: 'Publishes Move code',
    detail: 'This can add new on-chain package code from your account.',
  },
  {
    key: 'upgrade',
    severity: 'danger',
    title: 'Upgrades Move code',
    detail: 'This can change package behavior controlled by your account.',
  },
  {
    key: 'transferobjects',
    severity: 'danger',
    title: 'Transfers objects',
    detail: 'This can move owned objects or tokens out of your account.',
  },
  {
    key: 'movecall',
    severity: 'warning',
    title: 'Calls Move code',
    detail: 'Review the package, module, and function before approving.',
  },
  {
    key: 'makemovevec',
    severity: 'warning',
    title: 'Builds object vectors',
    detail: 'This can pass multiple objects into a Move call.',
  },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function parseDisplayValue(displayValue: string): unknown | null {
  try {
    return JSON.parse(displayValue)
  } catch {
    return null
  }
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function collectNormalizedKeys(value: unknown, keys = new Set<string>()) {
  if (Array.isArray(value)) {
    for (const item of value) collectNormalizedKeys(item, keys)
    return keys
  }

  if (!isRecord(value)) return keys

  for (const [key, child] of Object.entries(value)) {
    keys.add(normalizeKey(key))
    collectNormalizedKeys(child, keys)
  }

  return keys
}

function hasSharedObjectReference(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSharedObjectReference)

  if (!isRecord(value)) return false

  return Object.entries(value).some(([key, child]) => {
    const normalizedKey = normalizeKey(key)
    return (
      normalizedKey === 'sharedobject' ||
      normalizedKey === 'shared' ||
      hasSharedObjectReference(child)
    )
  })
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

export function reviewTransactionDisplay(
  displayValue: string,
): TransactionRiskFinding[] {
  const parsed = parseDisplayValue(displayValue)
  if (!parsed) {
    return [
      {
        severity: 'warning',
        title: 'Unverified transaction format',
        detail: 'The transaction payload could not be decoded for review.',
      },
    ]
  }

  const keys = collectNormalizedKeys(parsed)
  const commandFindings = COMMAND_RISK_RULES.filter((rule) =>
    keys.has(rule.key),
  )

  const sharedObjectFindings = hasSharedObjectReference(parsed)
    ? [
        {
          severity: 'warning',
          title: 'Uses shared objects',
          detail:
            'Shared object calls can change state used by other accounts.',
        } satisfies TransactionRiskFinding,
      ]
    : []

  return dedupeFindings([...commandFindings, ...sharedObjectFindings])
}
