import type { SVGProps } from "react";

const NetworkIcon = ({
  className,
  width = 16,
  height = 16,
  color = "#FF4700",
}: SVGProps<SVGSVGElement>) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 16 16"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Network"
    role="img"
  >
    <rect width="2" height="2" fill={color} fillOpacity="0.2" />
    <rect y="3" width="2" height="2" fill={color} />
    <rect y="6" width="2" height="2" fill={color} />
    <rect y="9" width="2" height="2" fill={color} fillOpacity="0.2" />
    <rect x="3" width="2" height="2" fill={color} />
    <rect x="3" y="3" width="2" height="2" fill={color} />
    <rect x="3" y="6" width="2" height="2" fill={color} />
    <rect x="3" y="9" width="2" height="2" fill={color} />
    <rect x="6" width="2" height="2" fill={color} />
    <rect x="6" y="3" width="2" height="2" fill={color} />
    <rect x="6" y="6" width="2" height="2" fill={color} />
    <rect x="6" y="9" width="2" height="2" fill={color} />
    <rect x="9" width="2" height="2" fill={color} fillOpacity="0.2" />
    <rect x="9" y="3" width="2" height="2" fill={color} />
    <rect x="9" y="6" width="2" height="2" fill={color} />
    <rect x="9" y="9" width="2" height="2" fill={color} fillOpacity="0.2" />
  </svg>
);

export default NetworkIcon;
