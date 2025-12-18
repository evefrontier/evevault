import type { SVGProps } from "react";

const HistoryIcon = ({
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
    aria-label="History"
    role="img"
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M9 0H16V16H9V14H14V2H9V0ZM7 0H0V16H7V14H2V2H7V0ZM7 4H4V12H7L7 4ZM9 12H12V4H9L9 12Z"
      fill={color}
    />
  </svg>
);

export default HistoryIcon;
