import type { SVGProps } from "react";

const ArrowLeftIcon = ({
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
    aria-label="Arrow Left"
    role="img"
  >
    <path
      d="M7.20996 12.6663L2.66675 7.99968L7.20996 3.33301L8.01983 4.16489L4.85934 7.41127H13.3334V8.58808H4.85934L8.01983 11.8345L7.20996 12.6663Z"
      fill={color}
    />
  </svg>
);

export default ArrowLeftIcon;
