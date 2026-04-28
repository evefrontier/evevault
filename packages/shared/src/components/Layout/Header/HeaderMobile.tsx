import type React from "react";
import { useMemo } from "react";
import { useAuth } from "#/auth";
import {
  type DropdownItem,
  DropdownSelect,
  getIdenticon,
} from "#/components/Dropdown";
import Switch from "#/components/Switch";
import Text from "#/components/Text";
import { useCopyToClipboard, useDevice } from "#/hooks";
import type { HeaderMobileProps, IconName } from "#/types";
import { formatAddress } from "#/utils";

export const HeaderMobile: React.FC<HeaderMobileProps> = ({
  address,
  email,
  logoSrc = "/images/logo.png",
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
  const { copy } = useCopyToClipboard();
  const { lock } = useDevice();
  const { logout } = useAuth();

  const dropdownItems: DropdownItem[] = useMemo(() => {
    const items: DropdownItem[] = [];

    // 1. Dev mode toggle (optional) – top of list, row with switch
    if (onDevModeToggle) {
      items.push({
        label: "Dev mode",
        icon: "Settings" as IconName,
        onClick: () => {},
        preventCloseOnClick: true,
        customContent: (
          <>
            {getIdenticon(0)}
            <Text variant="label">Dev mode</Text>
            <Switch
              isChecked={showDevActions}
              onChange={(_checked) => onDevModeToggle()}
            />
          </>
        ),
      });
    }

    // 2. Sign and submit test (only when dev mode on) – right under Dev mode
    if (showDevActions && onSignSubmitTxClick) {
      items.push({
        label: "Sign and submit test",
        icon: "ArrowRight" as IconName,
        onClick: onSignSubmitTxClick,
      });
    }

    // 3. Rotate eph key (only when dev mode on)
    if (showDevActions && onRotateEphKeyClick) {
      items.push({
        label: "Rotate eph key",
        icon: "Refresh" as IconName,
        onClick: onRotateEphKeyClick,
      });
    }

    // 4. Faucet test SUI (only when dev mode on)
    if (showDevActions && onFaucetTestSuiClick) {
      items.push({
        label: "Faucet test SUI",
        icon: "OpenWindow" as IconName,
        onClick: onFaucetTestSuiClick,
      });
    }

    // 5. Localnet Settings (only when dev mode on)
    if (showDevActions && onLocalnetSettingsClick) {
      items.push({
        label: "Localnet Settings",
        icon: "Settings" as IconName,
        onClick: onLocalnetSettingsClick,
      });
    }

    // 6. Copy Address (always)
    items.push({
      label: "Copy Address",
      icon: "Copy" as IconName,
      onClick: () => copy(address),
    });

    // 7. Transaction History (optional)
    if (onTransactionsClick) {
      items.push({
        label: "Transaction History",
        icon: "History" as IconName,
        onClick: onTransactionsClick,
      });
    }

    // 8. Lock Wallet (always)
    items.push({
      label: "Lock Wallet",
      icon: "HideEye" as IconName,
      onClick: lock,
    });

    // 9. Logout (always)
    items.push({
      label: "Logout",
      icon: "Close" as IconName,
      onClick: logout,
    });

    // 10. App version (dev only, display-only)
    if (showDevActions && version) {
      items.push({
        label: `v${version}`,
        icon: "Info" as IconName,
        onClick: () => {},
        preventCloseOnClick: true,
      });
    }

    return items;
  }, [
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
  ]);

  const displayText = email || formatAddress(address);

  return (
    <header className="flex flex-col w-full">
      <div className="flex justify-between items-start w-full">
        <img
          src={logoSrc}
          alt="EVE Vault"
          className="w-auto"
          style={{
            height: "clamp(3rem, calc(5rem - (500px - 100vw) * 0.08), 5rem)",
          }}
        />
        <DropdownSelect
          items={dropdownItems}
          trigger={displayText}
          identicon={identicon}
        />
      </div>
    </header>
  );
};

export default HeaderMobile;
