// Icon/index.tsx

import type { FC, SVGProps } from "react";
import type {
  BaseIconProps,
  IconComponent,
  IconName,
  IconWithoutNameProps,
} from "../../types";
import {
  Add,
  ArrowDown,
  ArrowDownSlant,
  ArrowLeft,
  ArrowRight,
  ArrowTurnDownRight,
  ArrowUpSlant,
  Assets,
  Browse,
  ChevronArrowDown,
  ChevronArrowLeft,
  ChevronArrowRight,
  ChevronArrowUp,
  Close,
  Copy,
  CorporationFolder,
  Edit,
  EveNet,
  Expand,
  Eye,
  Fitting,
  Folder,
  HideEye,
  History,
  ListView,
  MoreVertical,
  Network,
  OpenWindow,
  Refresh,
  Settings,
  Tokens,
} from "./Icons";

const iconMap: Record<IconName, FC<SVGProps<SVGSVGElement>>> = {
  Add,
  ArrowDown,
  ArrowDownSlant,
  ArrowLeft,
  ArrowRight,
  ArrowTurnDownRight,
  ArrowUpSlant,
  Assets,
  Browse,
  ChevronArrowDown,
  ChevronArrowLeft,
  ChevronArrowRight,
  ChevronArrowUp,
  Close,
  Copy,
  CorporationFolder,
  Edit,
  EveNet,
  Expand,
  Eye,
  Fitting,
  Folder,
  HideEye,
  History,
  ListView,
  MoreVertical,
  OpenWindow,
  Refresh,
  Settings,
  Network,
  Tokens,
};
const resolveColor = (c?: string) => {
  if (!c) return undefined;
  if (c === "currentColor") return c;
  const trimmed = c.trim();
  if (
    trimmed.startsWith("var(") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("rgb") ||
    trimmed.startsWith("hsl")
  ) {
    return trimmed;
  }
  // allow passing raw CSS var name like "--grey-neutral"
  if (trimmed.startsWith("--")) return `var(${trimmed})`;
  // treat as theme token, e.g. "neutral" => var(--neutral)
  return `var(--${trimmed})`;
};

const BaseIcon: FC<BaseIconProps> = ({
  name,
  size = "small",
  color = "#FFFFD6",
  width,
  height,
  ...rest
}) => {
  const Svg = iconMap[name];
  if (!Svg) return null;
  const iconSize =
    size === "small" ? "1rem" : size === "medium" ? "1.5rem" : "2rem";
  return (
    <Svg
      width={width ?? iconSize}
      height={height ?? iconSize}
      color={resolveColor(color)}
      {...rest}
    />
  );
};

const Icon = BaseIcon as IconComponent;

// Attach static components, e.g. Icon.Folder = (props) => <BaseIcon name="Folder" {...props} />
(Object.keys(iconMap) as IconName[]).forEach((name) => {
  Icon[name] = (props: IconWithoutNameProps) => (
    <BaseIcon {...props} name={name} />
  );
});

export default Icon;
