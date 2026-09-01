import type { GeneratedAliasKey } from '@evefrontier/wallet-core/address-alias'
import type React from 'react'
import { useState } from 'react'
import Button from '#/components/Button'
import Heading from '#/components/Heading'
import { Checkbox } from '#/components/Inputs'
import Text from '#/components/Text'
import { useCopyToClipboard } from '#/hooks'

/** Progress breadcrumb */
export const StepDots: React.FC<{
  steps: readonly string[]
  current: number
}> = ({ steps, current }) => (
  <div
    className="flex gap-2"
    role="progressbar"
    aria-valuenow={current}
    aria-valuemin={1}
    aria-valuemax={steps.length}
    aria-label={`Step ${current} of ${steps.length}`}
  >
    {steps.map((step, i) => (
      <span
        key={step}
        className={`h-2 w-2 rounded-full ${i < current ? 'bg-neutral' : 'bg-neutral/20'}`}
      />
    ))}
  </div>
)

/** Critical warning about the co-owner semantics of a personal access alias. */
export const RecoveryWarningBanner: React.FC = () => (
  <div className="w-full rounded border border-critical bg-critical/50 p-2">
    <Text variant="light" size="xsmall">
      Anyone with this recovery phrase or personal access key has complete,
      unilateral control over your account and can take all of its coins,
      balances, and other resources. Save it somewhere safe and private. It will
      be shown only once and is never stored by this app.
    </Text>
  </div>
)

/**
 * A labelled secret value with an optional format note. When `revealable`, the
 * value is blurred until the user clicks "Reveal"; copy is offered only once
 * revealed.
 */
const SecretField: React.FC<{
  label: string
  value: string
  onCopy: () => void
  formatHint?: string
  revealable?: boolean
}> = ({ label, value, onCopy, formatHint, revealable }) => {
  const [revealed, setRevealed] = useState(false)
  const hidden = revealable && !revealed

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-center">
        <Text variant="bold" size="small" color="neutral-90">
          {label}
        </Text>
        {hidden ? (
          <Button
            variant="secondary"
            size="small"
            onClick={() => setRevealed(true)}
          >
            Reveal
          </Button>
        ) : (
          <div className="flex gap-1">
            {revealable && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => setRevealed(false)}
              >
                Hide
              </Button>
            )}
            <Button variant="secondary" size="small" onClick={onCopy}>
              Copy
            </Button>
          </div>
        )}
      </div>
      {formatHint && (
        <Text
          variant="light"
          size="xsmall"
          color="neutral-60"
          style={{ fontSize: '12px', lineHeight: '16px' }}
        >
          {formatHint}
        </Text>
      )}
      <div className="w-full rounded border border-(--quantum-30) bg-(--quantum-10) p-2">
        <Text
          variant="light"
          size="xsmall"
          color="neutral-90"
          className={`break-all font-mono ${hidden ? 'blur-sm select-none' : ''}`}
        >
          {value}
        </Text>
      </div>
    </div>
  )
}

/** Step 1: introduce the personal access key and its co-owner risk before generating one. */
export const TermsStep: React.FC<{
  onContinue: () => void
  onCancel?: () => void
}> = ({ onContinue, onCancel }) => (
  <div className="flex flex-col gap-10">
    <div className="flex flex-col gap-4">
      <Heading level={2} variant="bold" color="neutral">
        Set up your personal access key
      </Heading>
      <Text variant="light" size="large" color="neutral-90">
        Before you can sign transactions, register a personal access key as an
        address alias. This key co-owns your account and lets you keep access if
        you lose this device. The next step generates it, shows your recovery
        methods, and registers it once you accept the terms.
      </Text>
    </div>

    <RecoveryWarningBanner />

    <div className="flex flex-col gap-4">
      <Button onClick={onContinue}>I understand — continue</Button>
      {onCancel && (
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  </div>
)

/**
 * Step 2 (terminal): reveal the generated key, then a single acceptance both
 * asserts the user read and agreed to the terms and registers the alias
 * on-chain. The register button is gated on the acceptance checkbox.
 */
export const RevealStep: React.FC<{
  aliasKey: GeneratedAliasKey
  accepted: boolean
  onAcceptChange: (accepted: boolean) => void
  isSubmitting: boolean
  /** Register the alias on-chain. Guarded by the acceptance checkbox. */
  onRegister: () => void
  /** Discard the generated key and return to the intro step. */
  onBack: () => void
  /** Exit without setting up a key. Omitted when there is no exit path. */
  onCancel?: () => void
}> = ({
  aliasKey,
  accepted,
  onAcceptChange,
  isSubmitting,
  onRegister,
  onBack,
  onCancel,
}) => {
  const { copy } = useCopyToClipboard('Copied to clipboard')

  return (
    <div className="flex flex-col gap-6 w-full">
      <SecretField
        label="Recovery phrase"
        value={aliasKey.mnemonic}
        revealable
        onCopy={() => copy(aliasKey.mnemonic)}
        formatHint="A standard 24-word BIP-39 mnemonic. Any wallet that supports BIP-39 can restore the same key from these words."
      />
      <SecretField
        label="Private key"
        value={aliasKey.privateKey}
        revealable
        onCopy={() => copy(aliasKey.privateKey)}
        formatHint="A Sui Ed25519 private key, Bech32-encoded with the 'suiprivkey1' prefix. Derived from the recovery phrase above — either one alone can restore this key."
      />
      <SecretField
        label="Alias address"
        value={aliasKey.address}
        onCopy={() => copy(aliasKey.address)}
        formatHint="The Sui address derived from this key. This is what gets registered on-chain as your alias."
      />

      <Checkbox
        name="accept-recovery"
        isChecked={accepted}
        isDisabled={isSubmitting}
        text="This key co-owns my account and won't be shown again. I've saved my recovery phrase or private key, or accept I may lose access forever."
        onChange={onAcceptChange}
      />

      <Button
        disabled={!accepted || isSubmitting}
        isLoading={isSubmitting}
        onClick={onRegister}
      >
        Set up personal access key
      </Button>

      <div className="flex gap-1">
        <Button variant="secondary" disabled={isSubmitting} onClick={onBack}>
          Back
        </Button>
        {onCancel && (
          <Button
            variant="secondary"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}

/** Success state shown once the alias is registered on-chain. */
export const RecoverySuccess: React.FC<{ onContinue: () => void }> = ({
  onContinue,
}) => (
  <div className="flex flex-col gap-10">
    <div className="flex flex-col gap-4">
      <Heading level={2} variant="bold" color="neutral">
        Recovery alias registered
      </Heading>
      <Text variant="light" size="large" color="neutral-90">
        Your personal access key is now a co-owner of your account. You can sign
        transactions.
      </Text>
    </div>
    <Button onClick={onContinue}>Continue</Button>
  </div>
)
