import type React from "react";
import { forwardRef, useState } from "react";
import "./style.css";
import type { InputProps } from "../../types";
import { Corners } from "../Corners";
import Text from "../Text";

const Input: React.FC<InputProps> = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = "base",
      label,
      errorText,
      statusText,
      uppercase = true,
      disabled = false,
      showLabel = true,
      height = "56px",
      value,
      placeholder,
      className,
      style,
      onFocus,
      onBlur,
      ...rest
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const hasValue = value !== undefined && value !== "";
    const showFloatingLabel = (showLabel && label) || hasValue;
    const labelText = label || placeholder;
    const inputId =
      rest.id ||
      `input-${label?.toLowerCase().replace(/\s+/g, "-") || "field"}`;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const containerClass = [
      "input-field",
      isFocused && "input-field--focused",
      errorText && "input-field--error",
      disabled && "input-field--disabled",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="input-wrapper" style={style}>
        <div className={containerClass} style={{ height }}>
          <Corners color="grey" size={5} thickness={1} />

          {/* Red accent line */}
          <span className="input-field__accent" />

          {/* Content */}
          <div className="input-field__content">
            {showFloatingLabel && (
              <label
                className={`input-field__label ${errorText ? "input-field__label--error" : ""}`}
                htmlFor={inputId}
              >
                {labelText}
              </label>
            )}
            <input
              ref={ref}
              id={inputId}
              className={`input-field__input input-field__input--${size}`}
              placeholder={placeholder?.toUpperCase()}
              value={value}
              disabled={disabled}
              onFocus={handleFocus}
              onBlur={handleBlur}
              style={{ textTransform: uppercase ? "uppercase" : "none" }}
              {...rest}
            />
          </div>
        </div>

        {statusText && (
          <Text size="small" color="grey-neutral" className="input-status">
            {statusText}
          </Text>
        )}

        {errorText && (
          <Text size="small" color="error" className="input-error" role="alert">
            {errorText}
          </Text>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
