import type React from 'react'
import { useState } from 'react'
import Text from '#/components/Text'
import { useAliasProvisioning } from '#/wallet'
import {
  RecoverySuccess,
  RevealStep,
  StepDots,
  TermsStep,
} from './AliasRecoverySetupScreen.parts'

export interface AliasRecoverySetupScreenProps {
  /** Called after successful registration (e.g. to refresh the enforcement gate). */
  onComplete?: () => void
  /**
   * Exit without setting up a key.
   */
  onCancel?: () => void
}

const STEP_ORDER = ['terms', 'reveal'] as const
type Step = (typeof STEP_ORDER)[number]

/**
 * Onboarding gate shown when a zkLogin account has no non-self address alias.
 * A two-step terms-and-conditions clickthrough: the user reads the terms, then
 * reveals a one-time client-only personal access key and accepts the terms —
 * that acceptance registers the key's address on-chain as an alias. A success
 * screen confirms setup.
 */
export const AliasRecoverySetupScreen: React.FC<
  AliasRecoverySetupScreenProps
> = ({ onComplete, onCancel }) => {
  const { aliasKey, generate, clear, register, isSubmitting, error, txDigest } =
    useAliasProvisioning()
  const [step, setStep] = useState<Step>('terms')
  const [accepted, setAccepted] = useState(false)

  if (txDigest) {
    return <RecoverySuccess onContinue={() => onComplete?.()} />
  }

  return (
    <div className="flex flex-col gap-10">
      <StepDots steps={STEP_ORDER} current={STEP_ORDER.indexOf(step) + 1} />

      {step === 'terms' && (
        <TermsStep
          onContinue={() => {
            if (!aliasKey) generate()
            setStep('reveal')
          }}
          onCancel={onCancel}
        />
      )}

      {step === 'reveal' && aliasKey && (
        <RevealStep
          aliasKey={aliasKey}
          accepted={accepted}
          onAcceptChange={setAccepted}
          isSubmitting={isSubmitting}
          // wallet-core's register(acknowledged) takes only a boolean; ticking
          // the acceptance checkbox is the acknowledgement.
          onRegister={() => register(true)}
          onBack={() => {
            clear()
            setAccepted(false)
            setStep('terms')
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
