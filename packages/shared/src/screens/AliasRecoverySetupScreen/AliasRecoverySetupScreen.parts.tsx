import type { GeneratedAliasKey } from '@evefrontier/wallet-core/address-alias'
import type React from 'react'
import Button from '#/components/Button'
import Heading from '#/components/Heading'
import { Checkbox } from '#/components/Inputs'
import Text from '#/components/Text'
import { useCopyToClipboard } from '#/hooks'

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

/** A labelled, copyable secret value, with an optional note describing its format. */
const SecretField: React.FC<{
  label: string
  value: string
  onCopy: () => void
  formatHint?: string
}> = ({ label, value, onCopy, formatHint }) => (
  <div className="flex flex-col gap-2 w-full">
    <div className="flex justify-between items-center">
      <Text variant="bold" size="small" color="neutral-90">
        {label}
      </Text>
      <Button variant="secondary" size="small" onClick={onCopy}>
        Copy
      </Button>
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
        className="break-all font-mono"
      >
        {value}
      </Text>
    </div>
  </div>
)

/** Reveals the generated personal access key once and gates registration on acknowledgement. */
export const RecoveryKeyReveal: React.FC<{
  aliasKey: GeneratedAliasKey
  acknowledged: boolean
  onAcknowledgeChange: (checked: boolean) => void
  isSubmitting: boolean
  onRegister: () => void
  /** Discard the generated key and return to the intro step. */
  onBack: () => void
  /** Exit without setting up a key. Omitted when there is no exit path. */
  onCancel?: () => void
}> = ({
  aliasKey,
  acknowledged,
  onAcknowledgeChange,
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
        onCopy={() => copy(aliasKey.mnemonic)}
        formatHint="A standard 24-word BIP-39 mnemonic. Any wallet that supports BIP-39 can restore the same key from these words."
      />
      <SecretField
        label="Private key"
        value={aliasKey.privateKey}
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
        name="acknowledge-recovery-key"
        isChecked={acknowledged}
        text="I've saved my recovery phrase and private key somewhere safe"
        isDisabled={isSubmitting}
        onChange={onAcknowledgeChange}
      />

      <Button
        disabled={!acknowledged || isSubmitting}
        isLoading={isSubmitting}
        onClick={onRegister}
      >
        Register personal access key
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
