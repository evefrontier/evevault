import { addAddressAliasTx } from '@evefrontier/wallet-core/address-alias'
import { Transaction } from '@mysten/sui/transactions'
import { describe, expect, it } from 'vitest'
import { transactionContainsAddressAliasCall } from '../aliasCallGuard'

const OWNER = `0x${'a'.repeat(64)}`
const ALIASES_OBJECT = `0x${'b'.repeat(64)}`
const ALIAS = `0x${'c'.repeat(64)}`
const COIN = `0x${'d'.repeat(64)}`

describe('transactionContainsAddressAliasCall', () => {
  it('is true for a transaction whose only command is an alias call', async () => {
    const tx = addAddressAliasTx(OWNER, ALIASES_OBJECT, ALIAS)
    expect(transactionContainsAddressAliasCall(await tx.toJSON())).toBe(true)
  })

  it('is true when an alias call is bundled with unrelated commands', async () => {
    const tx = new Transaction()
    tx.setSender(OWNER)
    tx.transferObjects([tx.object(COIN)], ALIAS)
    tx.moveCall({
      target: '0x2::address_alias::add',
      arguments: [tx.object(ALIASES_OBJECT), tx.pure.address(ALIAS)],
    })
    expect(transactionContainsAddressAliasCall(await tx.toJSON())).toBe(true)
  })

  it('is false for a plain transfer with no alias call', async () => {
    const tx = new Transaction()
    tx.setSender(OWNER)
    tx.transferObjects([tx.object(COIN)], ALIAS)
    expect(transactionContainsAddressAliasCall(await tx.toJSON())).toBe(false)
  })

  it('fails closed (true) for undecodable input', () => {
    expect(transactionContainsAddressAliasCall('not a transaction')).toBe(true)
    expect(transactionContainsAddressAliasCall(new Uint8Array([1, 2, 3]))).toBe(
      true,
    )
  })

  it('fails open (false) for undecodable input when failClosed is false', () => {
    expect(
      transactionContainsAddressAliasCall('not a transaction', {
        failClosed: false,
      }),
    ).toBe(false)
    expect(
      transactionContainsAddressAliasCall(new Uint8Array([1, 2, 3]), {
        failClosed: false,
      }),
    ).toBe(false)
  })
})
