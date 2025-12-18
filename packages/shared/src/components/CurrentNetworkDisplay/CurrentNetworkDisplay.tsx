import type { CurrentNetworkDisplayProps } from "@evevault/shared/types";
import type React from "react";
import Icon from "../Icon";
import Text from "../Text";

export const CurrentNetworkDisplay: React.FC<CurrentNetworkDisplayProps> = ({
  chain,
  className = "",
}) => {
  return (
    <div className={`flex items-end gap-2 ${className}`}>
      <Icon name="Network" color="quantum" />
      <div className="flex flex-col gap-0.5">
        <Text variant="label-small" color="neutral-50" size="small">
          NETWORK
        </Text>
        <Text variant="label-medium" size="medium">
          {chain.toUpperCase()}
        </Text>
      </div>
    </div>
  );
};

export default CurrentNetworkDisplay;
