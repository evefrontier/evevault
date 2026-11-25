import type React from 'react'
import { useState } from 'react'
import {
  AuthMark,
  AuthShell,
  AuthShellLink,
  AuthShellVersion,
  Button,
  Heading,
  ResetVaultDialog,
  SignInContextLine,
  Text,
} from '#/components'
import { useDevice } from '#/hooks/useDevice'
import { getCurrentTenantId } from '#/stores/tenantStore'
import { PinCells } from './PinCells'

export function LockScreen({
  isPinSet,
  unlock,
  onResetComplete,
  version,
}: {
  isPinSet: boolean
  unlock: (pin: string) => void
  /** Called after reset completes; use to redirect to `/` (e.g. window.location.href = "/") */
  onResetComplete?: () => void
  /** App version shown in the footer */
  version?: string
}) {
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const { initialize: initializeDevice, error: deviceError } = useDevice()

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPin(e.target.value.replace(/\D/g, ''))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pin.length !== 6) {
      setPinError('PIN must be 6 digits long')
      return
    }
    setPinError(null)
    if (!isPinSet) {
      await initializeDevice(pin)
    }
    await unlock(pin)
  }

  const title = isPinSet ? 'Enter pin' : 'Create pin'
  const description = isPinSet
    ? 'Enter your 6-digit PIN to open your account'
    : 'Create a 6-digit PIN to secure your account'

  const showReset = isPinSet || !!deviceError

  return (
    <AuthShell
      status="Locked"
      lamp="off"
      footer={
        (showReset || version) && (
          <>
            {showReset && (
              <AuthShellLink onClick={() => setShowResetConfirm(true)}>
                {isPinSet ? 'Forgot PIN? Reset vault' : 'Reset and try again'}
              </AuthShellLink>
            )}
            {version && <AuthShellVersion version={version} />}
          </>
        )
      }
    >
      <AuthMark variant="lock" />

      <header className="flex flex-col items-center gap-2 text-center">
        <Heading level={2}>{title}</Heading>
        <Text variant="light" size="medium" color="n60">
          {description}
        </Text>
      </header>

      <form
        onSubmit={handleSubmit}
        id="pin-input"
        className="flex flex-col items-center gap-5 w-full"
      >
        <PinCells
          label="6-digit PIN"
          onChange={handlePinChange}
          value={pin}
          errorText={pinError || deviceError || undefined}
        />
        <div className="w-full max-w-[288px]">
          <Button type="submit" size="fill">
            Submit
          </Button>
        </div>
      </form>

      <SignInContextLine
        tenant={{ currentTenantId: getCurrentTenantId(), viewOnly: true }}
      />

      <ResetVaultDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onResetComplete={onResetComplete}
      />
    </AuthShell>
  )
}
