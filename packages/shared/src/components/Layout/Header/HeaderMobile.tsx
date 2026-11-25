import type React from 'react'
import './HeaderMobile.css'
import { useMemo } from 'react'
import { useAuth } from '#/auth'
import { type DropdownItem, DropdownSelect } from '#/components/Dropdown'
import Switch from '#/components/Switch'
import { useCopyToClipboard, useDevice } from '#/hooks'
import type { HeaderMobileProps, IconName } from '#/types'
import { formatAddress } from '#/utils'
import { TopBar, TopBarStrip } from './TopBar'

/**
 * Dev-only actions (shown under "Dev mode" when the toggle is on). Each is
 * included only when its handler is provided. Ordered as they appear in the menu.
 */
type DevActionHandlerKey =
  | 'onSignSubmitTxClick'
  | 'onRotateEphKeyClick'
  | 'onFaucetTestSuiClick'
  | 'onLocalnetSettingsClick'

const DEV_DROPDOWN_ACTIONS = [
  {
    handlerKey: 'onSignSubmitTxClick',
    label: 'Sign and submit test',
    icon: 'ArrowRight',
  },
  {
    handlerKey: 'onRotateEphKeyClick',
    label: 'Rotate eph key',
    icon: 'Refresh',
  },
  {
    handlerKey: 'onFaucetTestSuiClick',
    label: 'Faucet test SUI',
    icon: 'OpenWindow',
  },
  {
    handlerKey: 'onLocalnetSettingsClick',
    label: 'Localnet Settings',
    icon: 'Settings',
  },
] as const satisfies ReadonlyArray<{
  handlerKey: DevActionHandlerKey
  label: string
  icon: IconName
}>

interface DropdownItemsParams {
  address: string
  showDevActions: boolean
  onDevModeToggle?: () => void | Promise<void>
  devHandlers: Partial<Record<DevActionHandlerKey, () => void>>
  onTransactionsClick?: () => void
  onAddressAliasesClick?: () => void
  onSettingsClick?: () => void
  version?: string
  unlockRemainingLabel?: string
  copy: (value: string) => void
  lock: () => void
  logout: () => void
}

/** Display-only row showing the Dev mode toggle inside the dropdown. */
const DevModeToggleContent = ({
  showDevActions,
  onToggle,
}: {
  showDevActions: boolean
  onToggle: () => void | Promise<void>
}) => (
  <>
    <span className="dropdown-select__item-text">Dev mode</span>
    <Switch
      isChecked={showDevActions}
      onChange={() => onToggle()}
      className="ml-auto"
    />
  </>
)

/** Builds the dropdown menu items in display order based on the active props. */
const buildDropdownItems = ({
  address,
  showDevActions,
  onDevModeToggle,
  devHandlers,
  onTransactionsClick,
  onAddressAliasesClick,
  onSettingsClick,
  version,
  unlockRemainingLabel,
  copy,
  lock,
  logout,
}: DropdownItemsParams): DropdownItem[] => {
  const items: DropdownItem[] = []

  // Dev mode toggle (optional) – top of list, row with switch
  if (onDevModeToggle) {
    items.push({
      label: 'Dev mode',
      onClick: () => {},
      preventCloseOnClick: true,
      customContent: (
        <DevModeToggleContent
          showDevActions={showDevActions}
          onToggle={onDevModeToggle}
        />
      ),
    })
  }

  // Wallet address (always); clicking copies it
  if (address) {
    items.push({
      label: formatAddress(address),
      icon: 'Copy',
      onClick: () => copy(address),
    })
  }

  // Transaction History (optional)
  if (onTransactionsClick) {
    items.push({
      label: 'Transaction History',
      onClick: onTransactionsClick,
    })
  }

  // Manage Address Aliases (optional)
  if (onAddressAliasesClick) {
    items.push({
      label: 'Manage Address Aliases',
      onClick: onAddressAliasesClick,
    })
  }

  // Settings (optional)
  if (onSettingsClick) {
    items.push({ label: 'Settings', onClick: onSettingsClick })
  }

  // Lock Wallet and Logout (always)
  items.push(
    { label: 'Lock Wallet', onClick: lock },
    { label: 'Logout', onClick: logout },
  )

  // Dev-only actions (only those whose handler is provided), under Dev mode
  if (showDevActions) {
    for (const { handlerKey, label, icon } of DEV_DROPDOWN_ACTIONS) {
      const onClick = devHandlers[handlerKey]
      if (onClick) items.push({ label, icon, onClick, devMode: true })
    }

    if (unlockRemainingLabel) {
      // Vault unlock countdown (dev only, display-only)
      items.push({
        label: `Unlock expires in ${unlockRemainingLabel}`,
        icon: 'HideEye',
        onClick: () => {},
        preventCloseOnClick: true,
        devMode: true,
      })
    }

    // App version (dev only, display-only)
    if (version) {
      items.push({
        label: `v${version}`,
        onClick: () => {},
        preventCloseOnClick: true,
        devMode: true,
      })
    }
  }

  return items
}

export const HeaderMobile: React.FC<HeaderMobileProps> = ({
  address,
  email,
  logoSrc = '/images/logo.png',
  chips,
  onTransactionsClick,
  onAddressAliasesClick,
  onSettingsClick,
  showDevActions = false,
  onDevModeToggle,
  onSignSubmitTxClick,
  onRotateEphKeyClick,
  onFaucetTestSuiClick,
  onLocalnetSettingsClick,
  version,
  unlockRemainingLabel,
}) => {
  const { copy } = useCopyToClipboard()
  const { lock } = useDevice()
  const { logout } = useAuth()

  const dropdownItems: DropdownItem[] = useMemo(
    () =>
      buildDropdownItems({
        address,
        showDevActions,
        onDevModeToggle,
        devHandlers: {
          onSignSubmitTxClick,
          onRotateEphKeyClick,
          onFaucetTestSuiClick,
          onLocalnetSettingsClick,
        },
        onTransactionsClick,
        onAddressAliasesClick,
        onSettingsClick,
        version,
        unlockRemainingLabel,
        copy,
        lock,
        logout,
      }),
    [
      onTransactionsClick,
      onAddressAliasesClick,
      onSettingsClick,
      showDevActions,
      onDevModeToggle,
      onSignSubmitTxClick,
      onRotateEphKeyClick,
      onFaucetTestSuiClick,
      onLocalnetSettingsClick,
      copy,
      address,
      lock,
      logout,
      version,
      unlockRemainingLabel,
    ],
  )

  const displayText = email || formatAddress(address)

  return (
    <TopBar
      logoSrc={logoSrc}
      end={
        <>
          {chips}
          <DropdownSelect items={dropdownItems} trigger={displayText} />
        </>
      }
      strip={
        <TopBarStrip label="Unlocked" lamp="on">
          {unlockRemainingLabel ? (
            <span>Locks in {unlockRemainingLabel}</span>
          ) : null}
        </TopBarStrip>
      }
    />
  )
}

export default HeaderMobile
