import type { SVGProps } from "react";

const ChevronArrowUpIcon = ({
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
    aria-label="Chevron Arrow Up"
    role="img"
  >
    <path d="M13 10L8 5L3 10" stroke={color} stroke-width="2" />
  </svg>
);

export default ChevronArrowUpIcon;
