import { formatAddress } from "@evevault/shared";
import { useAuth } from "@evevault/shared/auth";
import { useCopyToClipboard, useDevice } from "@evevault/shared/hooks";
import type { HeaderMobileProps, IconName } from "@evevault/shared/types";
import type React from "react";
import { useMemo } from "react";
import { Dropdown, type DropdownItem } from "../../Dropdown";

export const HeaderMobile: React.FC<HeaderMobileProps> = ({
  address,
  email,
  logoSrc = "/images/logo.png",
  identicon = 0,
  onTransactionsClick,
}) => {
  const { copy } = useCopyToClipboard();
  const { lock } = useDevice();
  const { logout } = useAuth();

  const dropdownItems: DropdownItem[] = useMemo(() => {
    const items: DropdownItem[] = [];

    // Add Transactions if callback provided
    if (onTransactionsClick) {
      items.push({
        label: "Transactions",
        icon: "History" as IconName,
        onClick: onTransactionsClick,
      });
    }

    items.push(
      {
        label: "Copy Address",
        icon: "Copy" as IconName,
        onClick: () => copy(address),
      },
      {
        label: "Lock Wallet",
        icon: "HideEye" as IconName,
        onClick: lock,
      },
      {
        label: "Logout",
        icon: "Close" as IconName,
        onClick: logout,
      },
    );

    return items;
  }, [onTransactionsClick, copy, address, lock, logout]);

  const displayText = email || formatAddress(address);

  return (
    <header className="flex flex-col w-full ">
      <div className="flex justify-between items-start w-full">
        <img src={logoSrc} alt="EVE Vault" className="h-20 w-auto" />
        <Dropdown
          items={dropdownItems}
          trigger={displayText}
          identicon={identicon}
        />
      </div>
    </header>
  );
};

export default HeaderMobile;
