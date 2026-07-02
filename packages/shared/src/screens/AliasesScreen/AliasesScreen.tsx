import type React from 'react'
import { useState } from 'react'
import Button from '#/components/Button'
import Heading from '#/components/Heading'
import { Input } from '#/components/Inputs'
import Text from '#/components/Text'
import type { AliasesScreenProps } from '#/types/components'
import { useAliases } from '#/wallet'

export const AliasesScreen: React.FC<AliasesScreenProps> = ({ onBack }) => {
  const {
    isAuthenticated,
    ownerAddress,
    enabled,
    aliases,
    maxAliases,
    isReading,
    readError,
    enable,
    addAlias,
    isSubmitting,
    error,
  } = useAliases()

  const [newAlias, setNewAlias] = useState('')

  const disabled = isSubmitting || !isAuthenticated || !ownerAddress
  const atMax = aliases.length >= maxAliases

  const handleAdd = async () => {
    await addAlias(newAlias)
    setNewAlias('')
  }

  return (
    <div className="flex flex-col gap-10">
      {/* <HeaderMobile
        address={suiAddress ?? ''}
        email={email ?? ''}
        onTransactionsClick={onBack}
      /> */}
      <div className="flex flex-col gap-4">
        <Heading level={2}>Manage aliases</Heading>
        <Text variant="light" size="large" color="neutral-90">
          An alias is an address allowed to act on behalf of this address.
        </Text>
      </div>

      <div className="w-full rounded border border-red-10/30 bg-red-10/10 p-2">
        <Text variant="light" size="xsmall" color="error">
          Any alias can unilaterally control this address and all its assets.
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
          Enable aliasing
        </Button>
      ) : (
        <div className="flex flex-col gap-4 w-full">
          <Text variant="bold" size="small" color="neutral-90">
            Current aliases ({aliases.length}/{maxAliases})
          </Text>

          {aliases.length === 0 ? (
            <Text variant="light" size="small" color="neutral-90">
              No aliases yet.
            </Text>
          ) : (
            <ul className="flex flex-col gap-1 w-full">
              {aliases.map((alias) => (
                <li key={alias} className="break-all">
                  <Text variant="light" size="small" color="neutral-90">
                    {alias}
                  </Text>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-6 items-start w-full">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="0x… alias address"
                value={newAlias}
                onChange={(event) => setNewAlias(event.target.value)}
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

export default AliasesScreen
