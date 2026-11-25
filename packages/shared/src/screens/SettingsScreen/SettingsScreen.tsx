import type { User } from 'oidc-client-ts'
import type React from 'react'
import { useState } from 'react'
import { getHeaderIdentity } from '#/auth'
import { Input } from '#/components/Inputs'
import { SubpageHeader } from '#/components/Layout'
import Switch from '#/components/Switch'
import { useContext } from '#/hooks/useContext'
import { useExplorer } from '#/hooks/useExplorer'
import type { ExplorerId } from '#/types'
import { BUILT_IN_EXPLORERS, checkExplorerTemplate } from '#/utils/explorer'
import './SettingsScreen.css'

const TEMPLATE_PLACEHOLDER =
  'https://explorer.example.com/{network}/tx/{digest}'

const EXPLORER_OPTIONS: ReadonlyArray<{
  id: ExplorerId
  name: string
  detail: string
}> = [
  ...BUILT_IN_EXPLORERS.map((e) => ({
    id: e.id,
    name: e.name,
    detail: e.host,
  })),
  { id: 'custom', name: 'Custom', detail: 'Your own URL template' },
]

export interface SettingsScreenProps {
  user: User
  onBack: () => void
  /** App version shown at the bottom, e.g. "0.0.11" */
  version?: string
  /** Extension only: opens Localnet settings, shown while dev mode is on */
  onLocalnetSettingsClick?: () => void
}

/** Preferences: block explorer for every "View on" link, and dev mode. */
export function SettingsScreen({
  user,
  onBack,
  version,
  onLocalnetSettingsClick,
}: SettingsScreenProps) {
  const { email, address } = getHeaderIdentity(user)
  const { devMode, setDevMode, chain } = useContext()
  const { explorer, setExplorer, nameFor } = useExplorer()
  const [template, setTemplate] = useState(explorer.customTemplate ?? '')

  const isCustom = explorer.id === 'custom'
  const check = template ? checkExplorerTemplate(template) : null

  const choose = (id: ExplorerId) =>
    setExplorer(
      id === 'custom' ? { id, customTemplate: template } : { ...explorer, id },
    )

  const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTemplate(e.target.value)
    setExplorer({ id: 'custom', customTemplate: e.target.value })
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <SubpageHeader
        title="Settings"
        email={email}
        address={address}
        onBack={onBack}
      />

      <section className="c-panel">
        <h3 className="c-panel__head">
          Block explorer
          <span>for every “View on” link</span>
        </h3>
        <fieldset className="settings-radios">
          <legend className="sr-only">Block explorer</legend>
          {EXPLORER_OPTIONS.map((option) => (
            <label key={option.id} className="settings-radio">
              <input
                type="radio"
                name="block-explorer"
                className="sr-only"
                checked={explorer.id === option.id}
                onChange={() => choose(option.id)}
              />
              <span className="settings-radio__dot" aria-hidden="true" />
              <span className="settings-radio__text">
                <b>{option.name}</b>
                <span>{option.detail}</span>
              </span>
              {option.id === 'suiscan' ? (
                <span className="settings-radio__tag">default</span>
              ) : null}
            </label>
          ))}
        </fieldset>

        {isCustom ? (
          <div className="settings-panel__custom">
            <Input
              type="text"
              label="Transaction URL template"
              placeholder={TEMPLATE_PLACEHOLDER}
              uppercase={false}
              value={template}
              errorText={
                check && !check.ok
                  ? `${check.error}. Links use Suiscan until it's fixed.`
                  : undefined
              }
              onChange={handleTemplateChange}
            />
            <span className="settings-hint">
              Use {'{digest}'} for the transaction and {'{network}'} for
              testnet, devnet or mainnet.
            </span>
          </div>
        ) : null}

        <div className="settings-panel__foot">
          <span className="settings-hint">
            If the chosen explorer doesn't cover the current network, links use
            Suiscan.
          </span>
          <span className="settings-hint">
            Links on this network open{' '}
            <b className="text-(--ink)">{nameFor(chain)}</b>
          </span>
        </div>
      </section>

      <section className="c-panel">
        <h3 className="c-panel__head">Developer</h3>
        <div className="settings-row">
          <span>
            Dev mode
            <span className="settings-hint block">
              Dev servers, Localnet and test actions
            </span>
          </span>
          <Switch isChecked={devMode} onChange={setDevMode} />
        </div>
        {devMode && onLocalnetSettingsClick ? (
          <button
            type="button"
            className="settings-row settings-row--link"
            onClick={onLocalnetSettingsClick}
          >
            Localnet settings
            <span aria-hidden="true">›</span>
          </button>
        ) : null}
      </section>

      {version ? (
        <dl className="c-kv">
          <dt>Version</dt>
          <dd>v{version}</dd>
        </dl>
      ) : null}
    </div>
  )
}

export default SettingsScreen
