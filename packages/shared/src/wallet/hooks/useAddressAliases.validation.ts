import { isValidSuiAddress } from '@mysten/sui/utils'
import { MAX_ADDRESS_ALIASES } from './useAddressAliases.config'

type ValidateAddressAliasParams = {
  addressAlias: string
  existing: string[]
}

/**
 * Returns the first blocking error for a candidate address alias, or `null` when
 * it is safe to submit.
 */
export const validateNewAddressAlias = ({
  addressAlias,
  existing,
}: ValidateAddressAliasParams): string | null => {
  const trimmed = addressAlias.trim()

  if (!trimmed) {
    return 'Enter an address to add as an address alias'
  }
  if (!isValidSuiAddress(trimmed)) {
    return 'Not a valid Sui address'
  }
  if (existing.includes(trimmed)) {
    return 'Address is already an address alias'
  }
  if (existing.length >= MAX_ADDRESS_ALIASES) {
    return `Maximum of ${MAX_ADDRESS_ALIASES} address aliases reached`
  }
  return null
}

/**
 * Returns an error when the address is not a current address alias, or `null`
 * when it is safe to remove.
 */
export const validateExistingAddressAlias = ({
  addressAlias,
  existing,
}: ValidateAddressAliasParams): string | null => {
  const trimmed = addressAlias.trim()

  if (!existing.includes(trimmed)) {
    return 'Address is not an address alias'
  }
  return null
}
