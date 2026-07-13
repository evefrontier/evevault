import { MAX_ADDRESS_ALIASES } from '@evefrontier/wallet-core/address-alias'
import type React from 'react'
import { useState } from 'react'
import { getHeaderIdentity } from '#/auth'
import { SubpageHeader } from '#/components'
import Button from '#/components/Button'
import { Input } from '#/components/Inputs'
import Text from '#/components/Text'
import type { AddressAliasesScreenProps } from '#/types/components'
import { useAddressAliases } from '#/wallet'

export const AddressAliasesScreen: React.FC<AddressAliasesScreenProps> = ({
  onBack,
  user,
}) => {
  const {
    isAuthenticated,
    ownerAddress,
    enabled,
    addressAliases,
    isReading,
    readError,
    enable,
    addAddressAlias,
    removeAddressAlias,
    isSubmitting,
    error,
  } = useAddressAliases()

  const [newAddressAlias, setNewAddressAlias] = useState('')

  const disabled = isSubmitting || !isAuthenticated || !ownerAddress
  const atMax = addressAliases.length >= MAX_ADDRESS_ALIASES

  const handleAdd = async () => {
    const added = await addAddressAlias(newAddressAlias)
    if (added) {
      setNewAddressAlias('')
    }
  }

  const { email, address } = getHeaderIdentity(user)
  return (
    <div className="flex flex-col gap-10">
      <SubpageHeader
        title="Manage Address Aliases"
        email={email}
        address={address}
        onBack={onBack}
      />
      <div className="flex flex-col gap-4">
        <Text variant="light" size="large" color="neutral-90">
          Address aliases let you set which keys are authorized to sign
          transactions for this Sui address.
        </Text>
      </div>

      <div className="w-full rounded border border-critical bg-critical/50 p-2">
        <Text variant="light" size="xsmall">
          Any alias has complete, unilateral control over the address and can
          take all of its coins, balances, and other resources. Treat alias
          changes with extreme caution. A new alias is effectively a co-owner of
          your address with full access.
        </Text>
      </div>

      {!isAuthenticated || !ownerAddress ? (
        <Text variant="light" size="small" color="neutral-90">
          Connect your wallet to manage aliases.
        </Text>
      ) : isReading ? (
        <Text variant="light" size="small" color="neutral-90">
          Loading aliases…
        </Text>
      ) : !enabled ? (
        <Button disabled={disabled} isLoading={isSubmitting} onClick={enable}>
          Enable address aliasing
        </Button>
      ) : (
        <div className="flex flex-col gap-4 w-full">
          <Text variant="bold" size="small" color="neutral-90">
            Current aliases ({addressAliases.length}/{MAX_ADDRESS_ALIASES})
          </Text>

          {addressAliases.length === 0 ? (
            <Text variant="light" size="small" color="neutral-90">
              No address aliases yet.
            </Text>
          ) : (
            <ul className="flex flex-col gap-1 w-full">
              {addressAliases.map((addressAlias) => (
                <li key={addressAlias} className="break-all">
                  <div
                    key={addressAlias}
                    className="break-all justify-start items-center gap-4 inline-flex"
                  >
                    <Text variant="light" size="small" color="neutral-90">
                      {addressAlias}{' '}
                      {addressAlias === ownerAddress && '(This address)'}
                    </Text>
                    {addressAlias !== ownerAddress && (
                      <Button
                        variant="secondary"
                        size="small"
                        disabled={disabled}
                        isLoading={isSubmitting}
                        onClick={() => removeAddressAlias(addressAlias)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-6 items-start w-full">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="0x… address alias"
                value={newAddressAlias}
                onChange={(event) => setNewAddressAlias(event.target.value)}
              />
            </div>
            <Button
              disabled={disabled || atMax}
              isLoading={isSubmitting}
              onClick={handleAdd}
            >
              Add alias
            </Button>
          </div>
        </div>
      )}

      {(error || readError) && (
        <div className="w-full rounded border border-red-10/30 bg-red-10/10 p-2">
          <Text variant="light" size="xsmall" color="error">
            {error ?? readError}
          </Text>
        </div>
      )}

      <Button variant="secondary" onClick={onBack}>
        Back
      </Button>
    </div>
  )
}

export default AddressAliasesScreen
