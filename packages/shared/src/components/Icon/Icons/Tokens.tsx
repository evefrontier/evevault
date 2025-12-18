import type { SVGProps } from "react";

const TokensIcon = ({
  className,
  width = 16,
  height = 16,
  color = "var(--neutral)",
}: SVGProps<SVGSVGElement>) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 16 16"
    fill={color}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Tokens"
    role="img"
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M0 0H16V7H14V2H2V7H0V0ZM0 9V16H16V9H14V14H2V9H0ZM4 9V12H12V9H4ZM12 7V4H4V7H12Z"
      fill={color}
    />
  </svg>
);

export default TokensIcon;
