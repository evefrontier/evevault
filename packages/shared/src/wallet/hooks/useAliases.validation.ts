import { isValidSuiAddress } from '@mysten/sui/utils'
import { MAX_ALIASES } from './useAliases.config'

type ValidateAliasParams = {
  alias: string
  existing: string[]
}

/**
 * Returns the first blocking error for a candidate alias, or `null` when it is
 * safe to submit. Mirrors the validation-helper style of `useSendToken`.
 */
export const validateNewAlias = ({
  alias,
  existing,
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
  if (existing.length >= MAX_ALIASES) {
    return `Maximum of ${MAX_ALIASES} aliases reached`
  }
  return null
}
