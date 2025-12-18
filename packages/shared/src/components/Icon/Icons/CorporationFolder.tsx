import type { SVGProps } from "react";

const CorporationFolderIcon = ({
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
    aria-label="Corporation Folder"
    role="img"
  >
    <path d="M4 3H7L9 5H2L4 3Z" fill={color} />
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M2 5H14V13H2V5ZM7.4 7L8 6L8.6 7H9V7.66667L9.2 8H11V9L9.5 9.75L11 12H10L8 10.5L6 12H5L6.5 9.75L5 9V8H6.8L7 7.66667V7H7.4Z"
      fill={color}
    />
  </svg>
);

export default CorporationFolderIcon;
