import type { SVGProps } from "react";

const ArrowUpSlantIcon = ({
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
    aria-label="Arrow Up Slant"
    role="img"
  >
    <g clip-path="url(#clip0_6589_63962)">
      <path
        d="M4.93639 3.40563L12.4286 3.42883L12.4518 10.921L11.1162 10.9169L11.1001 5.70493L4.13443 12.6706L3.18684 11.723L10.1525 4.75734L4.94053 4.7412L4.93639 3.40563Z"
        fill={color}
      />
    </g>
    <defs>
      <clipPath id="clip0_6589_63962">
        <rect width="16" height="16" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

export default ArrowUpSlantIcon;
