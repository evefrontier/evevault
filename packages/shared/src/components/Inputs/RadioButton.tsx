import { type FC, useState } from "react";
import type { RadioButtonProps } from "../../types";
import "./style.css";
import Text from "../Text";

const RadioButton: FC<RadioButtonProps> = ({
  name,
  value = "",
  isChecked,
  text,
  isDisabled,
  onChange,
  absolute,
  containerStyle,
  radioProps,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <label
      className={[
        "radio",
        absolute ? "radio--absolute" : undefined,
        isDisabled ? "radio--disabled" : undefined,
      ]
        .filter(Boolean)
        .join(" ")}
      style={containerStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className={[
          "radio__control",
          isHovered ? "radio__control--hovered" : undefined,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <input
          type="radio"
          className="radio__input"
          name={name}
          value={value}
          checked={isChecked}
          onClick={() => onChange(!isChecked)}
          disabled={isDisabled}
          {...radioProps}
        />
        <span className="radio__inner">
          <span className="radio__dot" />
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

export default RadioButton;
