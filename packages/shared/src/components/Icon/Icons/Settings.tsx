import type { SVGProps } from "react";

const SettingsIcon = ({
  className,
  width = 16,
  height = 16,
  color = "var(--neutral)",
}: SVGProps<SVGSVGElement>) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 16 16"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Settings"
    role="img"
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M16 0H0V16H16V0ZM4 4H12V12H4V4ZM2 14V2H14V14H2Z"
      fill={color}
    />
  </svg>
);

export default SettingsIcon;
