import type { CSSProperties } from "react";
import type { CornersColor, CornersProps } from "../../types";

const colorMap: Record<CornersColor, string> = {
  quantum: "#ff4700",
  "quantum-50": "rgba(255, 71, 0, 0.5)",
  neutral: "rgba(255, 255, 214, 1)",
  "neutral-50": "rgba(255, 255, 214, 0.5)",
  grey: "#d9d9d9",
  error: "rgb(255, 25, 41)",
  success: "#5ee39c",
};
/// Has to be in a position:relative parent to work properly
export const Corners = ({
  color = "quantum",
  size = 5,
  thickness = 1,
  className = "",
  style,
  bottomOffset,
  transition,
}: CornersProps) => {
  const cornerColor = colorMap[color];

  const baseCornerStyle: CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    zIndex: 1,
    ...(transition && { transition }),
  };

  const lineStyle: CSSProperties = {
    content: '""',
    position: "absolute",
    background: cornerColor,
  };

  const horizontalLine: CSSProperties = {
    ...lineStyle,
    width: size,
    height: thickness,
  };

  const verticalLine: CSSProperties = {
    ...lineStyle,
    width: thickness,
    height: size,
  };

  return (
    <>
      {/* Top-left corner */}
      <span
        className={`corners corners__corner corners__corner--tl ${className}`}
        style={{ ...baseCornerStyle, left: 0, top: 0, ...style }}
      >
        <span style={{ ...horizontalLine, left: 0, top: 0 }} />
        <span style={{ ...verticalLine, left: 0, top: 0 }} />
      </span>

      {/* Top-right corner */}
      <span
        className={`corners corners__corner corners__corner--tr ${className}`}
        style={{ ...baseCornerStyle, right: 0, top: 0, ...style }}
      >
        <span style={{ ...horizontalLine, right: 0, top: 0 }} />
        <span style={{ ...verticalLine, right: 0, top: 0 }} />
      </span>

      {/* Bottom-left corner */}
      <span
        className={`corners corners__corner corners__corner--bl ${className}`}
        style={{
          ...baseCornerStyle,
          left: 0,
          bottom: bottomOffset ? -bottomOffset : 0,
          ...style,
        }}
      >
        <span style={{ ...horizontalLine, left: 0, bottom: 0 }} />
        <span style={{ ...verticalLine, left: 0, bottom: 0 }} />
      </span>

      {/* Bottom-right corner */}
      <span
        className={`corners corners__corner corners__corner--br ${className}`}
        style={{
          ...baseCornerStyle,
          right: 0,
          bottom: bottomOffset ? -bottomOffset : 0,
          ...style,
        }}
      >
        <span style={{ ...horizontalLine, right: 0, bottom: 0 }} />
        <span style={{ ...verticalLine, right: 0, bottom: 0 }} />
      </span>
    </>
  );
};

export default Corners;
