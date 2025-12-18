import type { SVGProps } from "react";

const CopyIcon = ({
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
    aria-label="Copy"
    role="img"
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M12 8H8V12H12V8ZM6 6V14H14V6H6Z"
      fill={color}
    />
    <path d="M2 2H4V10H2V2Z" fill={color} />
    <path d="M2 2H10V4H2V2Z" fill={color} />
  </svg>
);

export default CopyIcon;
