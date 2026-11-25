import { useCallback, useState } from 'react'
import { resetVaultOnDevice } from '#/auth/resetVaultOnDevice'
import Modal from '#/components/Modal'
import Text from '#/components/Text'
import { useToast } from '#/components/Toast'

/**
 * Confirms before wiping EVE Vault from this device. Every reset entry point
 * opens this dialog; a failed reset keeps it open and shows a toast.
 */
export function ResetVaultDialog({
  isOpen,
  onClose,
  onResetComplete,
}: {
  isOpen: boolean
  onClose: () => void
  onResetComplete?: () => void
}) {
  const [isResetting, setIsResetting] = useState(false)
  const { showToast } = useToast()

  const handleConfirmReset = useCallback(async () => {
    setIsResetting(true)
    try {
      await resetVaultOnDevice()
      onClose()
      onResetComplete?.()
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Something went wrong while resetting the vault. Please try again.'
      showToast("Couldn't reset vault", message)
    } finally {
      setIsResetting(false)
    }
  }, [onClose, onResetComplete, showToast])

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isResetting && onClose()}
      title="Reset EVE Vault on this device?"
      className="modal--card"
      secondaryAction={{
        label: 'Cancel',
        onClick: onClose,
        disabled: isResetting,
      }}
      primaryAction={{
        label: 'Reset',
        onClick: handleConfirmReset,
        isLoading: isResetting,
      }}
      closeOnOverlayClick={!isResetting}
    >
      <div className="modal__divider" />
      <Text className="modal__card-message" color="grey-neutral">
        This will reset your PIN and remove all EVE Vault data from this device.
        Your wallet will be available after you recreate your PIN and sign back
        in.
      </Text>
    </Modal>
  )
}

export default ResetVaultDialog
