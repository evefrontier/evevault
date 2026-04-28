import { Button, Heading, Text } from "@evevault/shared/components";
import Icon from "@evevault/shared/components/Icon";
import Input from "@evevault/shared/components/Inputs/Input";
import { localnetKeyService } from "@evevault/shared/services/vaultService";
import { useDeviceStore } from "@evevault/shared/stores/deviceStore";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import { useTenantStore } from "@evevault/shared/stores/tenantStore";
import { createLogger, EXTENSION_ROUTES } from "@evevault/shared/utils";
import { SUI_LOCALNET_CHAIN } from "@mysten/wallet-standard";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

const log = createLogger();

function LocalnetSettingsPage() {
  const navigate = useNavigate();
  const { localnetUrl, setLocalnetUrl } = useNetworkStore();
  const [urlDraft, setUrlDraft] = useState(localnetUrl);
  const [urlStatus, setUrlStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");

  const [privateKeyDraft, setPrivateKeyDraft] = useState("");
  const [keyStatus, setKeyStatus] = useState<
    "idle" | "saving" | "ok" | "error"
  >("idle");
  const [keyError, setKeyError] = useState<string | null>(null);

  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const fetchAddress = async () => {
      const address = await localnetKeyService.getAddress();
      if (address) {
        setAddress(address);
      } else {
        setAddress(null);
      }
    };
    fetchAddress();
  }, []);

  const validateLocalnetRpcUrl = useCallback(async (rpcUrl: string) => {
    try {
      new URL(rpcUrl);
    } catch {
      throw new Error("Please enter a valid RPC URL");
    }
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getLatestSuiSystemState",
        params: [],
      }),
    });
    if (!response.ok) {
      throw new Error(`RPC request failed with status ${response.status}`);
    }
    const payload: { error?: { message?: string } } = await response.json();
    if (payload.error) {
      throw new Error(payload.error.message ?? "RPC validation failed");
    }
  }, []);

  const handleUrlSave = useCallback(async () => {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    setUrlStatus("loading");
    try {
      await validateLocalnetRpcUrl(trimmed);
      setLocalnetUrl(trimmed);
      await useDeviceStore.getState().initializeForChain(SUI_LOCALNET_CHAIN);
      setUrlStatus("ok");
    } catch (err) {
      log.warn("Localnet RPC validation failed", err);
      setUrlStatus("error");
    }
  }, [urlDraft, setLocalnetUrl]);

  const handleKeySave = useCallback(async () => {
    const trimmed = privateKeyDraft.trim();
    if (!trimmed) {
      setKeyError("Please enter a private key");
      return;
    }
    setKeyStatus("saving");
    setKeyError(null);
    try {
      const { address: newAddress } =
        await localnetKeyService.setKeypairFromPrivateKey(trimmed);
      setAddress(newAddress);
      setPrivateKeyDraft("");
      setKeyStatus("ok");
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Invalid key");
      setKeyStatus("error");
    }
  }, [privateKeyDraft]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate({ to: EXTENSION_ROUTES.HOME })}
          className="flex items-center justify-center"
        >
          <Icon
            name="ChevronArrowDown"
            color="neutral"
            width={20}
            height={20}
            className="rotate-90"
          />
        </button>
        <Heading level={3}>Localnet Settings</Heading>
      </div>

      <div className="flex flex-col gap-6 flex-1 overflow-y-auto">
        {/* RPC URL */}
        <section className="flex flex-col gap-2">
          <Input
            label="RPC URL"
            value={urlDraft}
            onChange={(e) => {
              setUrlDraft(e.target.value);
              setUrlStatus("idle");
            }}
            onKeyDown={(e) => e.key === "Enter" && void handleUrlSave()}
            placeholder="http://127.0.0.1:9000"
            uppercase={false}
            height="48px"
          />
          <div className="flex items-center justify-between gap-2">
            {urlStatus === "idle" && <span />}
            {urlStatus === "loading" && (
              <Text size="small" color="neutral-50">
                Connecting…
              </Text>
            )}
            {urlStatus === "ok" && (
              <Text size="small" color="quantum">
                Connected
              </Text>
            )}
            {urlStatus === "error" && (
              <Text size="small" color="error">
                Connection failed
              </Text>
            )}
            <Button
              size="small"
              onClick={() => void handleUrlSave()}
              disabled={urlStatus === "loading"}
            >
              Save URL
            </Button>
          </div>
        </section>

        {/* Private key input */}
        <section className="flex flex-col gap-2">
          <Text variant="label-small" color="neutral-50" size="small">
            PRIVATE KEY
          </Text>

          <Input
            label="Private key"
            onChange={(e) => {
              setPrivateKeyDraft(e.target.value);
              setKeyStatus("idle");
              setKeyError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && void handleKeySave()}
            placeholder="suiprivkey1..."
            value={privateKeyDraft}
            uppercase={false}
            height="48px"
            type="password"
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
          />
          {keyError && (
            <Text size="small" color="error">
              {keyError}
            </Text>
          )}
          <div className="flex items-center justify-between gap-2">
            {keyStatus === "ok" && (
              <Text size="small" color="quantum">
                Key loaded
              </Text>
            )}
            {keyStatus !== "ok" && <span />}
            <Button
              size="small"
              onClick={() => void handleKeySave()}
              disabled={keyStatus === "saving" || !privateKeyDraft.trim()}
            >
              Load Key
            </Button>
          </div>
        </section>

        {/* Current address (read-only) */}
        <section className="flex flex-col gap-2">
          <Text variant="label-small" color="neutral-50" size="small">
            SUI ADDRESS
          </Text>
          {address ? (
            <Text size="small" color="neutral" className="break-all font-mono">
              {address}
            </Text>
          ) : (
            <Text size="small" color="neutral-50">
              No keypair loaded
            </Text>
          )}
        </section>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/localnet-settings")({
  beforeLoad: () => {
    const { devMode } = useTenantStore.getState();
    if (!devMode) throw redirect({ to: "/" });
  },
  component: LocalnetSettingsPage,
});
