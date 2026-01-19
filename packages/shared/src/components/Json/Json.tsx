import type React from "react";
import { useMemo } from "react";
export interface JsonProps {
  value: string;
  className?: string;
  style?: React.CSSProperties;
  errorText?: string;
  fallback?: React.ReactNode;
}

const Json: React.FC<JsonProps> = ({
  value,
  className = "",
  style,
  errorText,
  fallback,
}) => {
  const {
    parsed: _parsed,
    error,
    prettyJson,
  } = useMemo(() => {
    if (!value || value.trim() === "") {
      return {
        parsed: null,
        error: null,
        prettyJson: "",
      };
    }

    try {
      const parsed = JSON.parse(value);
      const prettyJson = JSON.stringify(parsed, null, 2);
      return {
        parsed,
        error: null,
        prettyJson,
      };
    } catch (err) {
      return {
        parsed: null,
        error: err instanceof Error ? err.message : "Invalid JSON",
        prettyJson: null,
      };
    }
  }, [value]);

  const hasError = !!error || !!errorText;
  const displayText = hasError
    ? errorText || error || "Invalid JSON"
    : prettyJson;
  const shouldShowFallback = hasError && fallback !== undefined;

  const computedClassName =
    `font-mono whitespace-pre-wrap break-words overflow-y-auto scrollbar-thin ${className}`.trim();

  const computedStyle: React.CSSProperties = {
    fontFamily: '"M42_FLIGHT 721", monospace',
    ...style,
  };

  if (shouldShowFallback) {
    return <>{fallback}</>;
  }

  return (
    <pre
      className={computedClassName}
      style={{ ...computedStyle, width: "80vw" }}
    >
      <code>{displayText}</code>
    </pre>
  );
};

Json.displayName = "Json";

export default Json;
