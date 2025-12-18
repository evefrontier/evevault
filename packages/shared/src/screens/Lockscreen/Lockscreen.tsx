import {
  Button,
  CurrentNetworkDisplay,
  Heading,
  Input,
  Text,
} from "@evevault/shared/components";
import type React from "react";
import { useState } from "react";
import { useDevice } from "../../hooks/useDevice";
import { useNetworkStore } from "../../stores/networkStore";

export default function LockScreen({
  isPinSet,
  unlock,
}: {
  isPinSet: boolean;
  unlock: (pin: string) => void;
}) {
  const chain = useNetworkStore.getState().chain;
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const { initialize: initializeDevice } = useDevice();

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPin(e.target.value.replace(/\D/g, ""));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pin.length !== 6) {
      setPinError("PIN must be 6 digits long");
      return;
    }
    if (!isPinSet) await initializeDevice(pin);
    unlock(pin);
  };

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
            errorText={pinError || undefined}
          />
          <div className="w-full max-w-[300px]">
            <Button type="submit" size="fill">
              Submit
            </Button>
          </div>
        </form>
      </section>

      <div className="w-full">
        <CurrentNetworkDisplay chain={chain} className="justify-start" />
      </div>
    </div>
  );
}
