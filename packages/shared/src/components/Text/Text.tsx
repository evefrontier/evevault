import type { TextProps } from "@evevault/shared/types";
import type React from "react";

// Size classes for regular text
const sizeClasses: Record<string, string> = {
  xsmall: "text-xs leading-4 tracking-[-0.02em]",
  small: "text-sm leading-5 tracking-[-0.02em]",
  medium: "text-sm leading-5 tracking-[-0.02em]",
  large: "text-base leading-[22px] tracking-[-0.02em]",
};

// Weight classes for regular variants
const variantClasses: Record<string, string> = {
  light: "font-light",
  regular: "font-normal",
  bold: "font-bold",
  secondary: "font-normal",
};

// Label variants are complete styles (include size, weight, etc.)
const labelClasses: Record<string, string> = {
  label: "text-sm leading-5 font-bold uppercase tracking-[0.07em]",
  "label-semi":
    "text-sm leading-[120%] font-semibold uppercase tracking-[0.05em]",
  "label-medium": "text-sm leading-4 font-normal uppercase tracking-[0.06em]",
  "label-small": "text-[10px] leading-none font-normal tracking-normal",
};

// Label variants that use headline font
const headlineLabelVariants = ["label-medium", "label-small"];

const Text: React.FC<TextProps> = ({
  size = "medium",
  variant = "regular",
  color = "neutral",
  className = "",
  children,
  style,
  ...rest
}) => {
  const isLabel = variant.startsWith("label");
  const useHeadlineFont = headlineLabelVariants.includes(variant);

  const textClasses = isLabel
    ? labelClasses[variant] || labelClasses.label
    : `${sizeClasses[size]} ${variantClasses[variant]}`;

  const computedClassName = `${textClasses} ${className}`.trim();

  // Fonts are CSS variables from global.css, applied via inline style
  const fontFamily = useHeadlineFont
    ? "var(--font-headline)"
    : variant === "secondary"
      ? '"M42_FLIGHT 721", monospace'
      : "var(--font-body)";

  const computedStyle: React.CSSProperties = {
    fontFamily,
    color: color ? `var(--${color})` : undefined,
    ...style,
  };

  return (
    <p className={computedClassName} style={computedStyle} {...rest}>
      {children}
    </p>
  );
};

export default Text;
