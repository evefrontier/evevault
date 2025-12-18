import type { SVGProps } from "react";

const ArrowDownIcon = ({
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
    aria-label="Arrow Down"
    role="img"
  >
    <path
      d="M8.59998 10.7596L11.3636 7.99601C11.4807 7.87885 11.6707 7.87885 11.7878 7.99601L12.2121 8.42027C12.3292 8.53743 12.3292 8.72738 12.2121 8.84453L8.21208 12.8445C8.09493 12.9617 7.90498 12.9617 7.78782 12.8445L3.78782 8.84453C3.67066 8.72738 3.67066 8.53743 3.78782 8.42027L4.21208 7.99601C4.32924 7.87885 4.51919 7.87885 4.63635 7.99601L7.39998 10.7596L7.39998 3.36763C7.39998 3.20194 7.53429 3.06763 7.69998 3.06763H8.29998C8.46566 3.06763 8.59998 3.20194 8.59998 3.36763L8.59998 10.7596Z"
      fill={color}
    />
  </svg>
);

export default ArrowDownIcon;
