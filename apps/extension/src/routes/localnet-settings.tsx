import { Button, Heading, Text } from '@evevault/shared/components'
import Icon from '@evevault/shared/components/Icon'
import Input from '@evevault/shared/components/Inputs/Input'
import { localnetKeyService } from '@evevault/shared/services/vaultService'
import { useContextStore, useDeviceStore } from '@evevault/shared/stores'
import { createLogger, EXTENSION_ROUTES } from '@evevault/shared/utils'
import { SUI_PRIVATE_KEY_PREFIX } from '@mysten/sui/cryptography'
import { SUI_LOCALNET_CHAIN } from '@mysten/wallet-standard'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

const log = createLogger()

type UrlStatus = 'idle' | 'loading' | 'ok' | 'error'
type KeyStatus = 'idle' | 'saving' | 'ok' | 'error'

async function validateLocalnetRpcUrl(rpcUrl: string) {
  try {
    new URL(rpcUrl)
  } catch {
    throw new Error('Please enter a valid RPC URL')
  }

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getLatestSuiSystemState',
      params: [],
    }),
  })

  if (!response.ok) {
    throw new Error(`RPC request failed with status ${response.status}`)
  }

  const payload: { error?: { message?: string } } = await response.json()
  if (payload.error) {
    throw new Error(payload.error.message ?? 'RPC validation failed')
  }
}

function SettingsHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        type="button"
        onClick={onBack}
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
  )
}

function UrlStatusText({ status }: { status: UrlStatus }) {
  if (status === 'loading') {
    return (
      <Text size="small" color="neutral-50">
        Connecting…
      </Text>
    )
  }
  if (status === 'ok') {
    return (
      <Text size="small" color="quantum">
        Connected
      </Text>
    )
  }
  if (status === 'error') {
    return (
      <Text size="small" color="error">
        Connection failed
      </Text>
    )
  }

  return <span />
}

function RpcUrlSection({
  urlDraft,
  urlStatus,
  onUrlChange,
  onUrlSave,
}: {
  urlDraft: string
  urlStatus: UrlStatus
  onUrlChange: (value: string) => void
  onUrlSave: () => void
}) {
  return (
    <section className="flex flex-col gap-2">
      <Input
        label="RPC URL"
        value={urlDraft}
        onChange={(e) => onUrlChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onUrlSave()}
        placeholder="http://127.0.0.1:9000"
        uppercase={false}
        height="48px"
      />
      <div className="flex items-center justify-between gap-2">
        <UrlStatusText status={urlStatus} />
        <Button
          size="small"
          onClick={onUrlSave}
          disabled={urlStatus === 'loading'}
        >
          Save URL
        </Button>
      </div>
    </section>
  )
}

function PrivateKeySection({
  privateKeyDraft,
  keyStatus,
  keyError,
  onPrivateKeyChange,
  onKeySave,
}: {
  privateKeyDraft: string
  keyStatus: KeyStatus
  keyError: string | null
  onPrivateKeyChange: (value: string) => void
  onKeySave: () => void
}) {
  return (
    <section className="flex flex-col gap-2">
      <Text variant="label-small" color="neutral-50" size="small">
        PRIVATE KEY
      </Text>

      <Input
        label="Private key"
        onChange={(e) => onPrivateKeyChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onKeySave()}
        placeholder={`${SUI_PRIVATE_KEY_PREFIX}1...`}
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
        {keyStatus === 'ok' ? (
          <Text size="small" color="quantum">
            Key loaded
          </Text>
        ) : (
          <span />
        )}
        <Button
          size="small"
          onClick={onKeySave}
          disabled={keyStatus === 'saving' || !privateKeyDraft.trim()}
        >
          Load Key
        </Button>
      </div>
    </section>
  )
}

function CurrentAddressSection({ address }: { address: string | null }) {
  return (
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
  )
}

function LocalnetSettingsPage() {
  const navigate = useNavigate()
  const {
    localnet: { url: localnetUrl },
    setLocalnetUrl,
  } = useDeviceStore()
  const [urlDraft, setUrlDraft] = useState(localnetUrl)
  const [urlStatus, setUrlStatus] = useState<UrlStatus>('idle')

  const [privateKeyDraft, setPrivateKeyDraft] = useState('')
  const [keyStatus, setKeyStatus] = useState<KeyStatus>('idle')
  const [keyError, setKeyError] = useState<string | null>(null)

  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    localnetKeyService
      .getAddress()
      .then((address) => setAddress(address ?? null))
  }, [])

  const handleUrlSave = useCallback(async () => {
    const trimmed = urlDraft.trim()
    if (!trimmed) return
    setUrlStatus('loading')
    try {
      await validateLocalnetRpcUrl(trimmed)
      setLocalnetUrl(trimmed)
      await useDeviceStore.getState().initializeForChain(SUI_LOCALNET_CHAIN)
      setUrlStatus('ok')
    } catch (err) {
      log.warn('Localnet RPC validation failed', err)
      setUrlStatus('error')
    }
  }, [urlDraft, setLocalnetUrl])

  const handleKeySave = useCallback(async () => {
    const trimmed = privateKeyDraft.trim()
    if (!trimmed) {
      setKeyError('Please enter a private key')
      return
    }
    setKeyStatus('saving')
    setKeyError(null)
    try {
      const { address: newAddress } =
        await localnetKeyService.setKeypairFromPrivateKey(trimmed)
      setAddress(newAddress)
      setPrivateKeyDraft('')
      setKeyStatus('ok')
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Invalid key')
      setKeyStatus('error')
    }
  }, [privateKeyDraft])

  return (
    <div className="flex flex-col h-full">
      <SettingsHeader onBack={() => navigate({ to: EXTENSION_ROUTES.HOME })} />

      <div className="flex flex-col gap-6 flex-1 overflow-y-auto">
        <RpcUrlSection
          urlDraft={urlDraft}
          urlStatus={urlStatus}
          onUrlChange={(value) => {
            setUrlDraft(value)
            setUrlStatus('idle')
          }}
          onUrlSave={() => void handleUrlSave()}
        />
        <PrivateKeySection
          privateKeyDraft={privateKeyDraft}
          keyStatus={keyStatus}
          keyError={keyError}
          onPrivateKeyChange={(value) => {
            setPrivateKeyDraft(value)
            setKeyStatus('idle')
            setKeyError(null)
          }}
          onKeySave={() => void handleKeySave()}
        />
        <CurrentAddressSection address={address} />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/localnet-settings')({
  beforeLoad: () => {
    const { devMode } = useContextStore.getState()
    if (!devMode) throw redirect({ to: '/' })
  },
  component: LocalnetSettingsPage,
})
