import type { SVGProps } from "react";

const FolderIcon = ({
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
    aria-label="Folder"
    role="img"
  >
    <path d="M7 3H4L2 5V13H14V5H9L7 3Z" fill={color} />
  </svg>
);

export default FolderIcon;
