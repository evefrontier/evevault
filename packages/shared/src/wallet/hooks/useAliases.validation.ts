import { isValidSuiAddress } from '@mysten/sui/utils'
import { MAX_ALIASES } from './useAliases.config'

type ValidateAliasParams = {
  alias: string
  existing: string[]
  max?: number
}

/**
 * Returns the first blocking error for a candidate alias, or `null` when it is
 * safe to submit. Mirrors the validation-helper style of `useSendToken`.
 */
export const validateNewAlias = ({
  alias,
  existing,
  max = MAX_ALIASES,
}: ValidateAliasParams): string | null => {
  const trimmed = alias.trim()

  if (!trimmed) {
    return 'Enter an address to add as an alias'
  }
  if (!isValidSuiAddress(trimmed)) {
    return 'Not a valid Sui address'
  }
  if (existing.includes(trimmed)) {
    return 'Address is already an alias'
  }
  if (existing.length >= max) {
    return `Maximum of ${max} aliases reached`
  }
  return null
}
