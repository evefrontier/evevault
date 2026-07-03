import { Text } from '@evevault/shared/components'
import type { TransactionRiskFinding } from '../transactionRiskReview'

export function TransactionRiskPanel({
  findings,
}: {
  findings: TransactionRiskFinding[]
}) {
  if (findings.length === 0) return null

  return (
    <div className="w-[80vw] max-h-32 overflow-y-auto border border(--matter-05)] p-2 text-left">
      <Text size="small" color="grey-neutral">
        Transaction warnings
      </Text>
      <div className="mt-2 flex flex-col gap-2">
        {findings
          .sort((a, b) => (a.severity === 'danger' ? -1 : 1))
          .map((finding) => (
            <div key={`${finding.severity}:${finding.title}`}>
              <Text
                size="small"
                variant="bold"
                color={finding.severity === 'danger' ? 'error' : 'neutral'}
              >
                {finding.title}
              </Text>
              <Text size="xsmall" color="grey-neutral">
                {finding.detail}
              </Text>
            </div>
          ))}
      </div>
    </div>
  )
}
