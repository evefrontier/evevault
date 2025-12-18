import type { SVGProps } from "react";

const AddIcon = ({
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
    role="img"
    aria-label="Add"
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M9 2H7V7H2V9H7V14H9V9H14V7H9V2Z"
      fill={color}
    />
  </svg>
);

export default AddIcon;
