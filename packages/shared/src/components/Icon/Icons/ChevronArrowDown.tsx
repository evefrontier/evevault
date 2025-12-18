import type { SVGProps } from "react";

const ChevronArrowDownIcon = ({
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
    aria-label="Chevron Arrow Down"
    role="img"
  >
    <path d="M13 5.5L8 10.5L3 5.5" stroke={color} stroke-width="2" />
  </svg>
);

export default ChevronArrowDownIcon;
