import type { SVGProps } from "react";

const OpenWindowIcon = ({
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
    aria-label="Open Window"
    role="img"
  >
    <path
      d="M12.5862 2H10V0H16V6H14V3.41464L10.5 6.91584L9.0857 5.50172L12.5862 2Z"
      fill={color}
    />
    <path
      d="M8 2.00154H2V14.0015H14V8.00154L12 10.0015V12.0015H4V4.00154H6L8 2.00154Z"
      fill={color}
    />
  </svg>
);

export default OpenWindowIcon;
