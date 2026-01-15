import type { SuiChain } from "@mysten/wallet-standard";
import type { FileRouteTypes } from "node_modules/@tanstack/react-router/dist/cjs/index.cjs";
import type { User } from "oidc-client-ts";
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  Dispatch,
  FC,
  InputHTMLAttributes,
  ReactNode,
  SetStateAction,
  SVGProps,
} from "react";
import type { ThemeToken } from "../theme/colorTheme";

export interface SwitchProps {
  isChecked: boolean;
  onChange: (
    isChecked: boolean,
  ) => undefined | Dispatch<SetStateAction<boolean>>;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export interface TokenListProps {
  user: User | null;
  chain: SuiChain | null;
  onAddToken?: () => void;
  onSendToken?: (coinType: string) => void;
}

export interface TokenRowProps {
  coinType: string;
  user: User | null;
  chain: SuiChain | null;
}

export type BracketsProps = {
  color?: ThemeToken;
  spacing?: number; // px
  boxWidth?: string | number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Show brackets only on hover */
  showOnHover?: boolean;
};

export type ButtonSize = "small" | "medium" | "large" | "fill";
export type ButtonVariant = "primary" | "secondary" | "text" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
  isLoading?: boolean;
  iconNameLeft?: IconName;
  iconNameRight?: IconName;
  iconColor?: ThemeToken;
  bracketFocusColor?: ThemeToken;
  /** Internal flag to suppress brackets when used inside composite components */
  isDuoChild?: boolean;
};

export type DuoButtonProps = {
  primaryLabel?: ReactNode;
  secondaryLabel?: ReactNode;
  onPrimaryActionPress?: () => void;
  onSecondaryActionPress?: () => void;
  buttonSize?: ButtonSize;
  variant?: "primary" | "alert";
  hidePrimaryAction?: boolean;
  hideSecondaryAction?: boolean;
  primaryActionProps?: ButtonProps;
  secondaryActionProps?: ButtonProps;
  wrap?: boolean;
  alert?: boolean;
};

// Icons
const iconNames = [
  "Add",
  "ArrowDown",
  "ArrowDownSlant",
  "ArrowLeft",
  "ArrowRight",
  "ArrowTurnDownRight",
  "ArrowUpSlant",
  "Assets",
  "Browse",
  "ChevronArrowDown",
  "ChevronArrowLeft",
  "ChevronArrowRight",
  "ChevronArrowUp",
  "Close",
  "Copy",
  "CorporationFolder",
  "Edit",
  "EveNet",
  "Expand",
  "Eye",
  "Fitting",
  "Folder",
  "HideEye",
  "History",
  "ListView",
  "MoreVertical",
  "OpenWindow",
  "Refresh",
  "Settings",
  "Network",
  "Tokens",
] as const;
export type IconName = (typeof iconNames)[number];

export type BaseIconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: "small" | "medium" | "large";
  color?: string;
};

export type IconWithoutNameProps = Omit<BaseIconProps, "name">;

// main <Icon /> component type
export type IconComponent = FC<BaseIconProps> & {
  // static members: Icon.Folder, Icon.Whatever
  [K in IconName]: FC<IconWithoutNameProps>;
};

export type CheckBoxProps = {
  name?: string;
  value?: string;
  isChecked: boolean;
  text?: string;
  description?: string;
  focusable?: boolean;
  isDisabled?: boolean;
  onChange?:
    | React.Dispatch<React.SetStateAction<boolean>>
    | ((isSelected: boolean) => void);
  isIndeterminate?: boolean;
  containerStyle?: React.CSSProperties;
  checkBoxProps?: React.InputHTMLAttributes<HTMLInputElement>;
  absolute?: boolean;
  children?: React.ReactNode;
};

export type InputSize = "small" | "base" | "large";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: InputSize;
  label?: string;
  errorText?: string;
  statusText?: string;
  uppercase?: boolean;
  showLabel?: boolean;
  height?: string;
}

export type RadioButtonProps = {
  name?: string;
  value?: string;
  isChecked: boolean;
  text?: string;
  isDisabled?: boolean;
  onChange: (
    idChecked: boolean,
  ) => undefined | React.Dispatch<React.SetStateAction<boolean>>;
  absolute?: boolean;
  containerStyle?: React.CSSProperties;
  radioProps?: React.InputHTMLAttributes<HTMLInputElement>;
};

export type TextProps = React.HTMLAttributes<HTMLParagraphElement> & {
  size?: "xsmall" | "small" | "medium" | "large";
  variant?:
    | "light"
    | "regular"
    | "bold"
    | "secondary"
    | "label"
    | "label-semi"
    | "label-medium"
    | "label-small";
  color?: ThemeToken;
  style?: React.CSSProperties;
  className?: string;
  rest?: React.HTMLAttributes<HTMLParagraphElement>;
  children: React.ReactNode;
};

export interface HeaderMobileProps {
  address: string;
  email: string;
  logoSrc?: string;
  identicon?: number;
  /** Callback when "Transactions" menu item is clicked */
  onTransactionsClick?: () => void;
}

export type CornersColor =
  | "quantum"
  | "quantum-50"
  | "neutral"
  | "neutral-50"
  | "grey"
  | "error"
  | "success";

export interface CornersProps {
  color?: CornersColor;
  size?: number;
  thickness?: number;
  className?: string;
  style?: CSSProperties;
  /** For animated bottom corners (like dropdown expand) */
  bottomOffset?: number;
  /** Transition duration for animations */
  transition?: string;
}

export interface CurrentNetworkDisplayProps {
  chain: string;
  className?: string;
  onNetworkSwitchStart?: (
    previousNetwork: string,
    targetNetwork: string,
  ) => void;
}

export interface AddTokenScreenProps {
  user: User | null;
  chain: SuiChain | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export interface SendTokenScreenProps {
  coinType: string;
  onCancel?: () => void;
}

export interface DropdownItem {
  label: string;
  icon?: IconName;
  onClick: () => void;
}

export interface DropdownProps {
  items: DropdownItem[];
  trigger: React.ReactNode;
  className?: string;
  /** Identicon index (0-3) for avatar display */
  identicon?: number;
}

export type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  variant?: "regular" | "bold" | "secondary";
  color?: ThemeToken;
  style?: React.CSSProperties;
  className?: string;
  rest?: React.HTMLAttributes<HTMLHeadingElement>;
  children: React.ReactNode;
};

export type NavItem = {
  name: string;
  path: string;
  icon: string;
  label: string;
};

export interface NavigationBarProps {
  items: readonly NavItem[];
  activePath?: string;
}

export interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export interface TokenRowProps {
  coinType: string;
  user: User | null;
  chain: SuiChain | null;
  isSelected: boolean;
  onSelect: () => void;
  onCopyAddress: (address: string) => void;
}

export type LayoutVariant = "web" | "extension";

export interface LayoutProps {
  children: React.ReactNode;
  /** Layout variant: "web" (default) for full app, "extension" for browser popup */
  variant?: LayoutVariant;
  showNav?: boolean;
  navItems?: NavigationBarProps["items"];
  /** Extension variant: props for HeaderMobile (required when variant="extension") */
  headerProps?: HeaderMobileProps;
}

export type RoutePath = FileRouteTypes["to"];

export type NavPath = RoutePath | "/tokens" | "/assets" | "/history";

// Transaction History Types
export type TransactionDirection = "sent" | "received";

export interface Transaction {
  /** Unique transaction digest */
  digest: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Whether user sent or received this transaction */
  direction: TransactionDirection;
  /** Recipient if sent, sender if received */
  counterparty: string;
  /** Formatted amount (human-readable) */
  amount: string;
  /** Token symbol (e.g., "SUI", "USDC") */
  tokenSymbol: string;
  /** Full coin type identifier */
  coinType: string;
}

export interface TransactionsScreenProps {
  user: User;
  chain: string;
  onBack: () => void;
}

export interface TransactionRowProps {
  transaction: Transaction;
  chain: string;
  isExpanded: boolean;
  onToggle: () => void;
}
