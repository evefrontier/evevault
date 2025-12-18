import type { SVGProps } from "react";

const AssetsIcon = ({
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
    aria-label="Assets"
    role="img"
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M16 0H9V2H14V7H16V0ZM16 9H14V14H9V16H16V9ZM12 7V4H9V7H12ZM9 9H12V12H9V9ZM7 7V4H4V7H7ZM4 9H7V12H4V9ZM2 7V2H7V0H0V7H2ZM0 9V16H7V14H2V9H0Z"
      fill={color}
    />
  </svg>
);

export default AssetsIcon;
