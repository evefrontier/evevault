import type { TransactionRiskFinding } from '@evefrontier/wallet-core/transaction'
import { Text } from '@evevault/shared/components'

export function TransactionRiskPanel({
  findings,
}: {
  findings: TransactionRiskFinding[]
}) {
  if (findings.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {[...findings]
        .sort(
          (a, b) =>
            (a.severity === 'danger' ? 0 : 1) -
            (b.severity === 'danger' ? 0 : 1),
        )
        .map((finding) => (
          <div
            key={`${finding.severity}:${finding.title}`}
            className={`c-banner ${finding.severity === 'danger' ? 'c-banner--red' : 'c-banner--amber'}`}
          >
            <Text
              size="small"
              variant="bold"
              color={finding.severity === 'danger' ? 'error' : 'neutral'}
            >
              {finding.title}
            </Text>
            <Text size="xsmall" color="n60">
              {finding.detail}
            </Text>
          </div>
        ))}
    </div>
  )
}
