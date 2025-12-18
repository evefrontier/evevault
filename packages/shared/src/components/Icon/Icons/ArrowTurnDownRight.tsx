import type { SVGProps } from "react";

const ArrowTurnDownRightIcon = ({
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
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Arrow Turn Down Right"
    role="img"
  >
    <path d="M8 13V5L13 9L8 13Z" fill={color} />
    <path d="M4 4V9H8" stroke={color} stroke-width="2" />
  </svg>
);

export default ArrowTurnDownRightIcon;
