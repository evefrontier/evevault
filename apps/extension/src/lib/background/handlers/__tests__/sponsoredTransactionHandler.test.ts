import { SponsoredTransactionActions } from '@evefrontier/wallet-core/sponsored-transaction'
import { describe, expect, it } from 'vitest'
import { toSponsoredInput } from '../sponsoredTransactionHandler'

const metadata = { name: 'Name', description: '', url: '' }

describe('toSponsoredInput', () => {
  it('keeps only metadata for update-metadata', () => {
    expect(
      toSponsoredInput({
        action: SponsoredTransactionActions.UPDATE_METADATA,
        entityId: '1',
        metadata,
        on: true,
      }),
    ).toEqual({
      txAction: SponsoredTransactionActions.UPDATE_METADATA,
      entityId: '1',
      metadata,
    })
  })

  it('keeps only on for set-power-grid', () => {
    expect(
      toSponsoredInput({
        action: SponsoredTransactionActions.SET_POWER_GRID,
        entityId: '1',
        metadata,
        on: false,
      }),
    ).toEqual({
      txAction: SponsoredTransactionActions.SET_POWER_GRID,
      entityId: '1',
      on: false,
    })
  })

  it.each([
    { action: 'online', entityId: '1', metadata },
    { action: SponsoredTransactionActions.UPDATE_METADATA, entityId: '1' },
    { action: SponsoredTransactionActions.SET_POWER_GRID, entityId: '1' },
  ])('rejects $action without its fields', (message) => {
    expect(() => toSponsoredInput(message)).toThrow(
      `Invalid sponsored transaction request: ${message.action}`,
    )
  })
})
