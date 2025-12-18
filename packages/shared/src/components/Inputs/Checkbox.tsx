import type { CheckBoxProps } from "@evevault/shared/types";

import { type FC, useState } from "react";
import "./style.css";
import Text from "../Text";

const Checkbox: FC<CheckBoxProps> = ({
  name,
  isChecked,
  text,
  isDisabled,
  onChange,
  containerStyle,
  checkBoxProps,
  absolute,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <label
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={[
        "checkbox",
        absolute && "checkbox--absolute",
        isDisabled && "checkbox--disabled",
      ]
        .filter(Boolean)
        .join(" ")}
      style={containerStyle}
    >
      <span
        className={[
          "checkbox__control",
          isHovered && "checkbox__control--hovered",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <input
          type="checkbox"
          className="checkbox__input"
          checked={isChecked}
          name={name}
          onChange={(e) => {
            onChange?.(e.currentTarget.checked);
          }}
          disabled={isDisabled}
          {...checkBoxProps}
        />
        <span className="checkbox__inner">
          <span className="checkbox__box" />
          <svg
            className="checkbox__check"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M13.293 3.29297L14.7072 4.70718L6.00008 13.4143L1.29297 8.70718L2.70718 7.29297L6.00008 10.5859L13.293 3.29297Z"
              fill="var(--neutral)"
            />
          </svg>
        </span>
      </span>
      {text ? (
        <Text size="large" variant="label-semi" color="neutral">
          {text}
        </Text>
      ) : null}
    </label>
  );
};

export default Checkbox;
