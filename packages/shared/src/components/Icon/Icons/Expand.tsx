import type { SVGProps } from "react";

const ExpandIcon = ({
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
    aria-label="Expand"
    role="img"
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M1 7V3V1H3H7V3L4.41427 3L6.70713 5.29287L5.29292 6.70708L3 4.41416V7H1ZM5.53554 9.53554L3 12.0711L3 9H1V13V15H3L7 15L7 13L4.89951 13L6.94975 10.9498L5.53554 9.53554ZM9.29286 10.707L11.5858 13L9 13V15H13H15V13L15 9H13V11.5857L10.7071 9.29281L9.29286 10.707ZM10.9497 6.94981L13 4.89951V7H15V3V1H13H9V3L12.0711 3L9.53548 5.5356L10.9497 6.94981Z"
      fill={color}
    />
  </svg>
);

export default ExpandIcon;
