import type { SVGProps } from "react";

const EditIcon = ({
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
    aria-label="Edit"
    role="img"
  >
    <path
      d="M14.7071 2.70718L8.4143 9H7V7.58588L13.2929 1.29297L14.7071 2.70718Z"
      fill={color}
    />
    <path d="M2 2H8L6 4H4V12H12V10L14 8V14H2V2Z" fill={color} />
  </svg>
);

export default EditIcon;
