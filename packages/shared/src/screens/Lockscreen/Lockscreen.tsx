import type React from "react";
import { useCallback, useState } from "react";
import { resetVaultOnDevice } from "../../auth/resetVaultOnDevice";
import {
  Button,
  Heading,
  Input,
  Modal,
  NetworkSelector,
  Text,
  useToast,
} from "../../components";
import { useDevice } from "../../hooks/useDevice";
import { useNetworkStore } from "../../stores/networkStore";

export default function LockScreen({
  isPinSet,
  unlock,
  onResetComplete,
}: {
  isPinSet: boolean;
  unlock: (pin: string) => void;
  /** Called after reset completes; use to redirect to `/` (e.g. window.location.href = "/") */
  onResetComplete?: () => void;
}) {
  const chain = useNetworkStore.getState().chain;
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { initialize: initializeDevice, error: deviceError } = useDevice();
  const { showToast } = useToast();

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPin(e.target.value.replace(/\D/g, ""));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pin.length !== 6) {
      setPinError("PIN must be 6 digits long");
      return;
    }
    setPinError(null);
    if (!isPinSet) {
      await initializeDevice(pin);
    }
    await unlock(pin);
  };

  const handleConfirmReset = useCallback(async () => {
    setIsResetting(true);
    try {
      await resetVaultOnDevice();
      setShowResetConfirm(false);
      onResetComplete?.();
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Something went wrong while resetting the vault. Please try again.";
      showToast(message);
    } finally {
      setIsResetting(false);
    }
  }, [onResetComplete, showToast]);

  const title = isPinSet ? "Enter pin" : "Create pin";
  const description = isPinSet
    ? "Enter your 6-digit PIN to open your account"
    : "Create a 6-digit PIN to secure your account";

  return (
    <div className="flex flex-col items-center justify-between gap-4 w-full h-full">
      <section className="flex flex-col items-center gap-10 w-full flex-1">
        <img
          src="/images/logo.png"
          alt="Evevault Logo"
          className="h-20 w-auto"
        />

        <header className="flex flex-col items-center gap-4 text-center">
          <Heading level={2}>{title}</Heading>
          <Text variant="light" size="large">
            {description}
          </Text>
        </header>

        <form
          onSubmit={handleSubmit}
          id="pin-input"
          className="flex flex-col items-center gap-6 w-full"
        >
          <Input
            type="password"
            placeholder="6-digit PIN"
            onChange={handlePinChange}
            value={pin}
            errorText={pinError || deviceError || undefined}
          />
          <div className="w-full max-w-[300px]">
            <Button type="submit" size="fill">
              Submit
            </Button>
          </div>
        </form>

        {isPinSet && (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                setShowResetConfirm(true);
              }
            }}
            className="text-sm underline text-grey-neutral hover:text-neutral focus:outline-none focus:ring-2 focus:ring-primary rounded"
          >
            Forgot PIN
          </button>
        )}

        <NetworkSelector chain={chain} className="align-self-start w-full" />
      </section>

      <Modal
        isOpen={showResetConfirm}
        onClose={() => !isResetting && setShowResetConfirm(false)}
        title="Reset EVE Vault on this device?"
        className="modal--card"
        secondaryAction={{
          label: "Cancel",
          onClick: () => setShowResetConfirm(false),
          disabled: isResetting,
        }}
        primaryAction={{
          label: "Reset",
          onClick: handleConfirmReset,
          isLoading: isResetting,
        }}
        closeOnOverlayClick={!isResetting}
      >
        <div className="modal__divider" />
        <Text className="modal__card-message" color="grey-neutral">
          This will reset your PIN and remove all EVE Vault data from this
          device. Your wallet will be available after you recreate your PIN and
          sign back in.
        </Text>
      </Modal>
    </div>
  );
}
