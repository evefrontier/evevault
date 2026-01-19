import React from "react";
import type { HeadingProps } from "../../types";

const variantClasses: Record<string, string> = {
  regular: "font-normal",
  bold: "font-bold",
  secondary: "font-normal",
};

export const Heading: React.FC<HeadingProps> = ({
  level,
  variant = "regular",
  color = "neutral",
  className = "",
  children,
  style,
  ...rest
}) => {
  const tagName = `h${level}` as keyof HTMLElementTagNameMap;

  const computedClassName =
    `m-0 ${variantClasses[variant]} ${className}`.trim();

  const computedStyle: React.CSSProperties = {
    color: color ? `var(--${color})` : undefined,
    ...(variant === "secondary" && {
      fontFamily: '"M42_FLIGHT 721", monospace',
    }),
    ...style,
  };

  return React.createElement(
    tagName,
    {
      className: computedClassName,
      style: computedStyle,
      ...rest,
    },
    children,
  );
};

export default Heading;
