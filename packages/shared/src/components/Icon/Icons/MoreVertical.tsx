import type { SVGProps } from "react";

const MoreVerticalIcon = ({
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
    aria-label="More Vertical"
    role="img"
  >
    <rect x="7" y="3" width="2" height="2" fill={color} />
    <rect x="7" y="7" width="2" height="2" fill={color} />
    <rect x="7" y="11" width="2" height="2" fill={color} />
  </svg>
);

export default MoreVerticalIcon;
