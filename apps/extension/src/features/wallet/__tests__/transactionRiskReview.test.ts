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
        expect.objectContaining({
          severity: 'danger',
          title: 'Transfers objects',
        }),
        expect.objectContaining({
          severity: 'warning',
          title: 'Calls Move code',
        }),
        expect.objectContaining({
          severity: 'warning',
          title: 'Builds object vectors',
        }),
      ]),
    )
  })

  it('flags package publishing and upgrades as dangerous', () => {
    const findings = reviewTransaction({
      commands: [{ Publish: { modules: [] } }, { Upgrade: { modules: [] } }],
    })

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'danger',
          title: 'Publishes Move code',
        }),
        expect.objectContaining({
          severity: 'danger',
          title: 'Upgrades Move code',
        }),
      ]),
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

    expect(findings).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        title: 'Uses shared objects',
      }),
    )
  })

  it('flags an undecodable transaction as danger', () => {
    expect(reviewTransaction(undefined)).toEqual([
      expect.objectContaining({
        severity: 'danger',
        title: 'Unverified transaction format',
      }),
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
      expect.objectContaining({
        severity: 'danger',
        title: 'Unverified transaction format',
      }),
    ])
  })

  it('supports command arrays nested under data', () => {
    expect(
      reviewTransaction({
        data: {
          commands: [{ kind: 'MoveCall' }],
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        title: 'Calls Move code',
      }),
    )
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
