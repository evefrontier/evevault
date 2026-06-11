import type React from 'react'
import { useMemo } from 'react'
import { useAuth } from '#/auth'
import {
  type DropdownItem,
  DropdownSelect,
  getIdenticon,
} from '#/components/Dropdown'
import Switch from '#/components/Switch'
import Text from '#/components/Text'
import { useCopyToClipboard, useDevice } from '#/hooks'
import type { HeaderMobileProps, IconName } from '#/types'
import { formatAddress } from '#/utils'

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
  version?: string
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
    {getIdenticon(0)}
    <Text variant="label">Dev mode</Text>
    <Switch isChecked={showDevActions} onChange={() => onToggle()} />
  </>
)

/** Builds the dropdown menu items in display order based on the active props. */
const buildDropdownItems = ({
  address,
  showDevActions,
  onDevModeToggle,
  devHandlers,
  onTransactionsClick,
  version,
  copy,
  lock,
  logout,
}: DropdownItemsParams): DropdownItem[] => {
  const items: DropdownItem[] = []

  // Dev mode toggle (optional) – top of list, row with switch
  if (onDevModeToggle) {
    items.push({
      label: 'Dev mode',
      icon: 'Settings',
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

  // Dev-only actions (only those whose handler is provided), under Dev mode
  if (showDevActions) {
    for (const { handlerKey, label, icon } of DEV_DROPDOWN_ACTIONS) {
      const onClick = devHandlers[handlerKey]
      if (onClick) items.push({ label, icon, onClick })
    }
  }

  // Copy Address (always)
  items.push({
    label: 'Copy Address',
    icon: 'Copy',
    onClick: () => copy(address),
  })

  // Transaction History (optional)
  if (onTransactionsClick) {
    items.push({
      label: 'Transaction History',
      icon: 'History',
      onClick: onTransactionsClick,
    })
  }

  // Lock Wallet and Logout (always)
  items.push(
    { label: 'Lock Wallet', icon: 'HideEye', onClick: lock },
    { label: 'Logout', icon: 'Close', onClick: logout },
  )

  // App version (dev only, display-only)
  if (showDevActions && version) {
    items.push({
      label: `v${version}`,
      onClick: () => {},
      preventCloseOnClick: true,
    })
  }

  return items
}

export const HeaderMobile: React.FC<HeaderMobileProps> = ({
  address,
  email,
  logoSrc = '/images/logo.png',
  identicon = 0,
  onTransactionsClick,
  showDevActions = false,
  onDevModeToggle,
  onSignSubmitTxClick,
  onRotateEphKeyClick,
  onFaucetTestSuiClick,
  onLocalnetSettingsClick,
  version,
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
        version,
        copy,
        lock,
        logout,
      }),
    [
      onTransactionsClick,
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
    ],
  )

  const displayText = email || formatAddress(address)

  return (
    <header className="flex flex-col w-full">
      <div className="flex justify-between items-start w-full">
        <img
          src={logoSrc}
          alt="EVE Vault"
          className="w-auto"
          style={{
            height: 'clamp(3rem, calc(5rem - (500px - 100vw) * 0.08), 5rem)',
          }}
        />
        <DropdownSelect
          items={dropdownItems}
          trigger={displayText}
          identicon={identicon}
        />
      </div>
    </header>
  )
}

export default HeaderMobile
