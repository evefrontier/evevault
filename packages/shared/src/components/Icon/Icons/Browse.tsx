import type { SVGProps } from "react";

const BrowseIcon = ({
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
    aria-label="Browse"
    role="img"
  >
    <circle cx="8" cy="8" r="6.5" stroke={color} />
    <path d="M8 1.5V15" stroke={color} />
    <path d="M2 10.5H14L13.5 11.5H3L2 10.5Z" fill={color} />
    <path d="M2.5 4.5H13.5L14 5.5H2L2.5 4.5Z" fill={color} />
    <path d="M2 7.5H14V8.5H2V7.5Z" fill={color} />
    <path d="M8 14.5C12.5 12 12.5 4 8 1.5" stroke={color} />
    <path d="M8 14.5C3.5 12 3.5 4 8 1.5" stroke={color} />
  </svg>
);

export default BrowseIcon;
