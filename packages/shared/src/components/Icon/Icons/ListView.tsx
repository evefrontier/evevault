import type { SVGProps } from "react";

const ListViewIcon = ({
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
    aria-label="List View"
    role="img"
  >
    <path d="M14 2H2V4H14V2Z" fill={color} />
    <path d="M14 7H2V9H14V7Z" fill={color} />
    <path d="M14 12H2V14H14V12Z" fill={color} />
  </svg>
);

export default ListViewIcon;
