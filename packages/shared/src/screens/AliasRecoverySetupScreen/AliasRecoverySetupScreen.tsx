import type React from 'react'
import { useState } from 'react'
import Button from '#/components/Button'
import Heading from '#/components/Heading'
import Text from '#/components/Text'
import { useAliasProvisioning } from '#/wallet'
import {
  RecoveryKeyReveal,
  RecoverySuccess,
  RecoveryWarningBanner,
} from './AliasRecoverySetupScreen.parts'

export interface AliasRecoverySetupScreenProps {
  /** Called after successful registration (e.g. to refresh the enforcement gate). */
  onComplete?: () => void
  /**
   * Exit without setting up a key.
   */
  onCancel?: () => void
}

/**
 * Onboarding gate shown when a zkLogin account has no non-self address alias.
 * Generates a one-time client-only personal access key, reveals it once, requires an
 * explicit acknowledgement, then registers its address on-chain as an alias —
 * unblocking signing.
 */
export const AliasRecoverySetupScreen: React.FC<
  AliasRecoverySetupScreenProps
> = ({ onComplete, onCancel }) => {
  const { aliasKey, generate, clear, register, isSubmitting, error, txDigest } =
    useAliasProvisioning()
  const [acknowledged, setAcknowledged] = useState(false)

  if (txDigest) {
    return <RecoverySuccess onContinue={() => onComplete?.()} />
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <Heading level={2} variant="bold" color="neutral">
          Set up your personal access key
        </Heading>
        <Text variant="light" size="large" color="neutral-90">
          Before you can sign transactions, register a personal access key as an
          address alias. This key co-owns your account and lets you keep access
          if you lose this device.
        </Text>
      </div>

      <RecoveryWarningBanner />

      {!aliasKey ? (
        <div className="flex flex-col gap-4">
          <Button isLoading={isSubmitting} onClick={generate}>
            Generate personal access key
          </Button>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      ) : (
        <RecoveryKeyReveal
          aliasKey={aliasKey}
          acknowledged={acknowledged}
          onAcknowledgeChange={setAcknowledged}
          isSubmitting={isSubmitting}
          onRegister={() => register(true)}
          onBack={() => {
            setAcknowledged(false)
            clear()
          }}
          onCancel={onCancel}
        />
      )}

      {error && (
        <div className="w-full rounded border border-red-10/30 bg-red-10/10 p-2">
          <Text variant="light" size="xsmall" color="error">
            {error}
          </Text>
        </div>
      )}
    </div>
  )
}

export default AliasRecoverySetupScreen
