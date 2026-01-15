import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import "./Button.css";
import type { ButtonProps } from "../../types";
import { Corners } from "../Corners";

export const Button: FC<ButtonProps> = ({
  size = "medium",
  variant = "primary",
  children,
  className = "",
  disabled,
  ...props
}) => {
  const sizeClass = `button--${size}`;
  const variantClass = `button--${variant}`;
  const disabledClass = disabled ? "button--disabled" : "";
  const showDecorations = variant === "primary" || variant === "secondary";

  const contentRef = useRef<HTMLSpanElement>(null);
  const [contentWidth, setContentWidth] = useState<number | undefined>();

  useEffect(() => {
    const updateWidth = () => {
      if (contentRef.current) {
        setContentWidth(contentRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return (
    <button
      className={`button ${sizeClass} ${variantClass} ${disabledClass} ${className}`.trim()}
      disabled={disabled}
      {...props}
    >
      {/* Main content */}
      <span ref={contentRef} className="button__content">
        {children}
      </span>

      {showDecorations && (
        <>
          <Corners color="quantum" size={5} thickness={1} />

          {/* Edge lines */}
          <span className="button__edge-left" />
          <span className="button__edge-right" />

          {/* Hover overlay */}
          <span className="button__hover">
            <span
              className="button__hover-content"
              style={{ width: contentWidth }}
            >
              {children}
            </span>
          </span>
        </>
      )}
    </button>
  );
};

export default Button;
