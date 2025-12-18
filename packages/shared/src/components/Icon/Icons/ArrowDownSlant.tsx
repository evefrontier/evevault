import type { SVGProps } from "react";

const ArrowDownSlantIcon = ({
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
    aria-label="Arrow Down Slant"
    role="img"
  >
    <g clip-path="url(#clip0_6589_63965)">
      <path
        d="M11.1528 12.2194L3.66065 12.1962L3.63745 4.70398L4.97302 4.70811L4.98915 9.92007L11.9548 2.95442L12.9024 3.90201L5.93674 10.8677L11.1487 10.8838L11.1528 12.2194Z"
        fill={color}
      />
    </g>
    <defs>
      <clipPath id="clip0_6589_63965">
        <rect width="16" height="16" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

export default ArrowDownSlantIcon;
