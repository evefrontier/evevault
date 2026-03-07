import type React from "react";
import { useMemo } from "react";
import { useAuth } from "../../../auth";
import { useCopyToClipboard, useDevice } from "../../../hooks";
import type { HeaderMobileProps, IconName } from "../../../types";
import { formatAddress } from "../../../utils";
import {
  type DropdownItem,
  DropdownSelect,
  getIdenticon,
} from "../../Dropdown";
import Switch from "../../Switch";
import Text from "../../Text";

export const HeaderMobile: React.FC<HeaderMobileProps> = ({
  address,
  email,
  logoSrc = "/images/logo.png",
  identicon = 0,
  onTransactionsClick,
  showDevActions = false,
  onDevModeToggle,
  onSignSubmitTxClick,
  onTokenRefreshTestClick,
  onFaucetTestSuiClick,
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
        onClick: onDevModeToggle,
        preventCloseOnClick: true,
        customContent: (
          <>
            {getIdenticon(0)}
            <Text variant="label">Dev mode</Text>
            <button
              type="button"
              className="border-0 bg-transparent p-0 font-inherit"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <Switch
                isChecked={showDevActions}
                onChange={(_checked) => onDevModeToggle()}
              />
            </button>
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

    // 3. Token refresh test (only when dev mode on)
    if (showDevActions && onTokenRefreshTestClick) {
      items.push({
        label: "Token refresh test",
        icon: "Refresh" as IconName,
        onClick: onTokenRefreshTestClick,
      });
    }

    // 3b. Faucet test SUI (only when dev mode on)
    if (showDevActions && onFaucetTestSuiClick) {
      items.push({
        label: "Faucet test SUI",
        icon: "OpenWindow" as IconName,
        onClick: onFaucetTestSuiClick,
      });
    }

    // 4. Copy Address (always)
    items.push({
      label: "Copy Address",
      icon: "Copy" as IconName,
      onClick: () => copy(address),
    });

    // 5. Transaction History (optional)
    if (onTransactionsClick) {
      items.push({
        label: "Transaction History",
        icon: "History" as IconName,
        onClick: onTransactionsClick,
      });
    }

    // 6. Lock Wallet (always)
    items.push({
      label: "Lock Wallet",
      icon: "HideEye" as IconName,
      onClick: lock,
    });

    // 7. Logout (always)
    items.push({
      label: "Logout",
      icon: "Close" as IconName,
      onClick: logout,
    });

    return items;
  }, [
    onTransactionsClick,
    showDevActions,
    onDevModeToggle,
    onSignSubmitTxClick,
    onTokenRefreshTestClick,
    onFaucetTestSuiClick,
    copy,
    address,
    lock,
    logout,
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
