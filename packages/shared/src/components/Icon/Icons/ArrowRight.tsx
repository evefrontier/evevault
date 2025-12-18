import type { SVGProps } from "react";

const ArrowRightIcon = ({
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
    aria-label="Arrow Right"
    role="img"
  >
    <path
      d="M8.79004 3.33366L13.3333 8.00032L8.79004 12.667L7.98017 11.8351L11.1407 8.58873L2.66659 8.58873L2.66659 7.41192L11.1407 7.41192L7.98017 4.16554L8.79004 3.33366Z"
      fill={color}
    />
  </svg>
);

export default ArrowRightIcon;
