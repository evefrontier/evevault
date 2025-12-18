import type { SVGProps } from "react";

const EveNetIcon = ({
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
    aria-label="EveNet"
    role="img"
  >
    <path d="M7.1561 0H8.7561V1.71392H7.1561V0Z" fill={color} />
    <path d="M2 5.6655H4.1662V4.93577H14V2.76363H2V5.6655Z" fill={color} />
    <path d="M4.1662 10.03H2V12.9401H14V10.7818H4.1662V10.03Z" fill={color} />
    <path d="M14 8.93537H2V6.77333H14V8.93537Z" fill={color} />
    <path d="M8.7561 14.2861H7.1561V16H8.7561V14.2861Z" fill={color} />
  </svg>
);

export default EveNetIcon;
