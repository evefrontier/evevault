import { isAddressAliasCall } from '@evefrontier/wallet-core/address-alias'
import { Transaction } from '@mysten/sui/transactions'
import { createLogger } from '#/utils'

const log = createLogger()

/** Shown in the approval popup, and thrown as the refusal message, when a request carries an address-alias call. */
export const ADDRESS_ALIAS_SIGNING_BLOCKED =
  'Unable to complete signing: transactions containing address-aliasing ' +
  'calls can only be performed from within Eve Vault.'

/**
 * True when any command in the transaction is an address-alias MoveCall
 * ({@link isAddressAliasCall}). Returns `failClosed` (default `true`) when the
 * input can't be decoded.
 *
 * @param source A transaction JSON string (from `Transaction.toJSON()`) or its
 *   serialized kind bytes.
 */
export function transactionContainsAddressAliasCall(
  source: string | Uint8Array,
  opts: { failClosed?: boolean } = {},
): boolean {
  try {
    const { commands } = Transaction.from(source).getData()
    return commands.some((command) => isAddressAliasCall(command))
  } catch (error) {
    log.warn('Treating undecodable transaction as a possible alias call', {
      error,
    })
    return opts.failClosed ?? true
  }
}
