import { describe, expect, it } from 'vitest'
import {
  requiresAcknowledgement,
  reviewTransaction,
} from '../transactionRiskReview'

describe('reviewTransaction', () => {
  it('flags high-risk programmable transaction commands', () => {
    const findings = reviewTransaction({
      commands: [
        {
          TransferObjects: { objects: [{ Input: 0 }], address: { Input: 1 } },
        },
        {
          MoveCall: {
            package: '0x2',
            module: 'coin',
            function: 'transfer',
          },
        },
        { MakeMoveVec: { type: null, objects: [{ Input: 2 }] } },
      ],
    })

    expect(findings).toEqual(
      expect.arrayContaining([
        {
          severity: 'danger',
          title: 'Transfers objects',
          detail: 'This can move owned objects or tokens out of your account.',
        },
        {
          severity: 'warning',
          title: 'Calls Move code',
          detail: 'Review the package, module, and function before approving.',
        },
        {
          severity: 'warning',
          title: 'Builds object vectors',
          detail: 'This can pass multiple objects into a Move call.',
        },
      ]),
    )
  })

  it('flags package publishing and upgrades as dangerous', () => {
    const findings = reviewTransaction({
      commands: [{ Publish: { modules: [] } }, { Upgrade: { modules: [] } }],
    })

    expect(findings).toEqual(
      expect.arrayContaining([
        {
          severity: 'danger',
          title: 'Publishes Move code',
          detail: 'This can add new on-chain package code from your account.',
        },
        {
          severity: 'danger',
          title: 'Upgrades Move code',
          detail:
            'This can change package behavior controlled by your account.',
        },
      ]),
    )
  })

  it('flags address-alias module calls as dangerous', () => {
    const findings = reviewTransaction({
      commands: [
        {
          MoveCall: {
            package:
              '0x0000000000000000000000000000000000000000000000000000000000000002',
            module: 'address_alias',
            function: 'add',
          },
        },
      ],
    })

    expect(findings).toContainEqual({
      severity: 'danger',
      title: 'Modifies address aliases',
      detail: 'This can add or remove address aliases for your account.',
    })
  })

  it('matches short-form alias packages and dedupes repeated alias calls', () => {
    const findings = reviewTransaction({
      commands: [
        {
          MoveCall: {
            package: '0x2',
            module: 'address_alias',
            function: 'add',
          },
        },
        {
          MoveCall: {
            package:
              '0x0000000000000000000000000000000000000000000000000000000000000002',
            module: 'address_alias',
            function: 'remove',
          },
        },
      ],
    })

    // Short-form ("0x2") and fully padded packages both match, and the two
    // alias calls collapse to a single finding.
    expect(
      findings.filter((f) => f.title === 'Modifies address aliases'),
    ).toEqual([
      {
        severity: 'danger',
        title: 'Modifies address aliases',
        detail: 'This can add or remove address aliases for your account.',
      },
    ])
  })

  it('does not flag or throw on a malformed alias package value', () => {
    const findings = reviewTransaction({
      commands: [
        {
          MoveCall: {
            package: 'not-a-real-address',
            module: 'address_alias',
            function: 'add',
          },
        },
      ],
    })

    expect(findings.some((f) => f.title === 'Modifies address aliases')).toBe(
      false,
    )
  })

  it('flags shared object references', () => {
    const findings = reviewTransaction({
      inputs: [
        {
          Object: {
            SharedObject: {
              objectId: '0xshared',
              initialSharedVersion: 1,
              mutable: true,
            },
          },
        },
      ],
    })

    expect(findings).toContainEqual({
      severity: 'warning',
      title: 'Uses shared objects',
      detail: 'Shared object calls can change state used by other accounts.',
    })
  })

  it('flags an undecodable transaction as danger', () => {
    expect(reviewTransaction(undefined)).toEqual([
      {
        severity: 'danger',
        title: 'Unverified transaction format',
        detail: 'The transaction payload could not be decoded for review.',
      },
    ])
  })

  it('treats a payload with no commands or inputs as unverified, not as its metadata keys', () => {
    // Command-like keys living in metadata must not be misread as commands; and
    // because there is nothing reviewable, the payload is flagged unverified
    // rather than silently passing as safe.
    expect(
      reviewTransaction({
        metadata: {
          MoveCall: 'display label only',
          SharedObject: 'not an input object',
        },
      }),
    ).toEqual([
      {
        severity: 'danger',
        title: 'Unverified transaction format',
        detail: 'The transaction payload could not be decoded for review.',
      },
    ])
  })

  it('supports command arrays nested under data', () => {
    expect(
      reviewTransaction({
        data: {
          commands: [{ kind: 'MoveCall' }],
        },
      }),
    ).toContainEqual({
      severity: 'warning',
      title: 'Calls Move code',
      detail: 'Review the package, module, and function before approving.',
    })
  })
})

describe('requiresAcknowledgement', () => {
  it('requires acknowledgement for danger findings', () => {
    expect(requiresAcknowledgement(reviewTransaction(undefined))).toBe(true)
    expect(
      requiresAcknowledgement(
        reviewTransaction({
          commands: [{ TransferObjects: { objects: [], address: {} } }],
        }),
      ),
    ).toBe(true)
  })

  it('does not require acknowledgement for warning-only findings', () => {
    expect(
      requiresAcknowledgement(
        reviewTransaction({ commands: [{ kind: 'MoveCall' }] }),
      ),
    ).toBe(false)
  })

  it('does not require acknowledgement when there are no findings', () => {
    expect(requiresAcknowledgement(reviewTransaction({ commands: [] }))).toBe(
      false,
    )
  })
})
