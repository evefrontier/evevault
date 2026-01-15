import type React from "react";
import { useAuth } from "../../../auth";
import { useCopyToClipboard, useDevice } from "../../../hooks";
import type { HeaderMobileProps, IconName } from "../../../types";
import { formatAddress } from "../../../utils";
import { Dropdown, type DropdownItem } from "../../Dropdown";

export const HeaderMobile: React.FC<HeaderMobileProps> = ({
  address,
  email,
  logoSrc = "/images/logo.png",
  identicon = 0,
}) => {
  const { copy } = useCopyToClipboard();
  const { lock } = useDevice();
  const { logout } = useAuth();

  const dropdownItems: DropdownItem[] = [
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
  ];

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
