import type { SwitchProps } from "@evevault/shared/types";
import type React from "react";

const Switch: React.FC<SwitchProps> = ({
  isChecked,
  onChange,
  disabled,
  className = "",
  style,
}) => {
  const baseClasses =
    "w-[47px] h-8 inline-flex items-center justify-start p-1 bg-[var(--matter-02)] border border-[rgba(255,255,214,0.2)] cursor-pointer";
  const disabledClasses = disabled ? "opacity-60 cursor-default" : "";

  const thumbBaseClasses =
    "w-[19px] h-full block transition-transform duration-200 ease-out";
  const thumbStateClasses = isChecked
    ? "bg-[var(--quantum)] translate-x-[20px]"
    : "bg-[var(--matter-06)] translate-x-0";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      className={`${baseClasses} ${disabledClasses} ${className}`.trim()}
      style={style}
      onClick={() => onChange(!isChecked)}
      disabled={disabled}
    >
      <span className={`${thumbBaseClasses} ${thumbStateClasses}`} />
    </button>
  );
};

export default Switch;
