import { describe, expect, it } from 'vitest'
import { reviewTransactionDisplay } from '../transactionRiskReview'

describe('reviewTransactionDisplay', () => {
  it('flags high-risk programmable transaction commands', () => {
    const findings = reviewTransactionDisplay(
      JSON.stringify({
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
      }),
    )

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
    const findings = reviewTransactionDisplay(
      JSON.stringify({
        commands: [{ Publish: { modules: [] } }, { Upgrade: { modules: [] } }],
      }),
    )

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
    const findings = reviewTransactionDisplay(
      JSON.stringify({
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
      }),
    )

    expect(findings).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        title: 'Uses shared objects',
      }),
    )
  })

  it('warns when the transaction cannot be decoded as JSON', () => {
    expect(reviewTransactionDisplay('not json')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        title: 'Unverified transaction format',
      }),
    ])
  })
})
