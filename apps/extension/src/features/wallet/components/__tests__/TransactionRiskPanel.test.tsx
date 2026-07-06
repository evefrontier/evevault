import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TransactionRiskFinding } from '../../transactionRiskReview'
import { TransactionRiskPanel } from '../TransactionRiskPanel'

describe('TransactionRiskPanel', () => {
  it('renders nothing when findings is empty', () => {
    const { container } = render(<TransactionRiskPanel findings={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders all finding titles', () => {
    const findings: TransactionRiskFinding[] = [
      {
        severity: 'warning',
        title: 'Calls Move code',
        detail: 'Review the package.',
      },
      {
        severity: 'danger',
        title: 'Transfers objects',
        detail: 'This can move owned objects.',
      },
      {
        severity: 'danger',
        title: 'Modifies address aliases',
        detail: 'This can add or remove address aliases for your account.',
      },
    ]

    render(<TransactionRiskPanel findings={findings} />)

    expect(screen.getByText('Calls Move code')).toBeInTheDocument()
    expect(screen.getByText('Transfers objects')).toBeInTheDocument()
    expect(screen.getByText('Review the package.')).toBeInTheDocument()
    expect(screen.getByText('This can move owned objects.')).toBeInTheDocument()
    expect(screen.getByText('Modifies address aliases')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This can add or remove address aliases for your account.',
      ),
    ).toBeInTheDocument()
  })

  it('renders danger findings before warnings', () => {
    const findings: TransactionRiskFinding[] = [
      { severity: 'warning', title: 'Calls Move code', detail: 'w' },
      { severity: 'danger', title: 'Transfers objects', detail: 'd' },
    ]

    render(<TransactionRiskPanel findings={findings} />)

    const titles = screen.getAllByText(/Calls Move code|Transfers objects/)
    expect(titles.map((el) => el.textContent)).toEqual([
      'Transfers objects',
      'Calls Move code',
    ])
  })

  it('renders the panel header for non-empty findings', () => {
    const findings: TransactionRiskFinding[] = [
      { severity: 'warning', title: 'Calls Move code', detail: 'detail' },
    ]

    render(<TransactionRiskPanel findings={findings} />)

    expect(screen.getByText('Transaction warnings')).toBeInTheDocument()
  })
})
