import type { SVGProps } from "react";

const CloseIcon = ({
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
    aria-label="Close"
    role="img"
  >
    <path
      d="M4.41584 12.8974L12.9011 4.41211L11.4869 2.9979L3.00163 11.4832L4.41584 12.8974Z"
      fill={color}
    />
    <path
      d="M3.003 4.41609L11.4883 12.9014L12.9025 11.4872L4.41721 3.00187L3.003 4.41609Z"
      fill={color}
    />
  </svg>
);

export default CloseIcon;
