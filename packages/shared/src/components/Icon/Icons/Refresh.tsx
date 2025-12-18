import type { SVGProps } from "react";

const RefreshIcon = ({
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
    aria-label="Refresh"
    role="img"
  >
    <mask
      id="mask0_6589_63973"
      style={{ maskType: "alpha" }}
      maskUnits="userSpaceOnUse"
      x={0}
      y={0}
      width={16}
      height="16"
    >
      <path d="M16 9H11V6H16V0H0V16H16V9Z" fill="black" />
    </mask>
    <g mask="url(#mask0_6589_63973)">
      <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="2" />
    </g>
    <path d="M9 6H14V1" stroke={color} strokeWidth="2" />
  </svg>
);

export default RefreshIcon;
