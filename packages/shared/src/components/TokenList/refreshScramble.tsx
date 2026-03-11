/**
 * Scramble and loading UI used during manual balance refresh in the token list.
 * Kept in a separate file for readability (TokenSection stays focused on layout and state).
 */

/**
 * Scrambles the balance so the first digit never changes and the displayed value
 * never exceeds the actual balance.
 */
export function scrambleBalanceWithFixedFirst(text: string): string {
  if (!text || text === "...") return text;
  const normalized = text.replace(/,/g, "");
  const dotIndex = normalized.indexOf(".");
  const integerPart =
    dotIndex >= 0 ? normalized.slice(0, dotIndex) : normalized;
  const decimalPart = dotIndex >= 0 ? normalized.slice(dotIndex + 1) : "";
  const fullDigits = (integerPart + decimalPart).split("");
  if (fullDigits.length === 0) return text;

  const valueInUnits =
    BigInt(integerPart || "0") * 10n ** BigInt(decimalPart.length) +
    BigInt(decimalPart || "0");
  const totalDigits = fullDigits.length;
  const integerDigitsCount = integerPart.length;

  const result: string[] = [];
  for (let i = 0; i < totalDigits; i++) {
    if (i === 0) {
      result.push(fullDigits[0] ?? "0");
      continue;
    }
    const currentValue = BigInt(result.join("") + "0".repeat(totalDigits - i));
    const remainingPower = 10n ** BigInt(totalDigits - i - 1);
    const headroom = valueInUnits - currentValue;
    if (headroom < 0n) {
      result.push("0");
      continue;
    }
    const maxDigitNum = Number(headroom / remainingPower);
    const maxDigit = Math.min(9, Math.max(0, maxDigitNum));
    const digit = Math.floor(Math.random() * (maxDigit + 1));
    result.push(String(digit));
  }

  const resultInteger = result.slice(0, integerDigitsCount).join("");
  const resultDecimal = result.slice(integerDigitsCount).join("");
  return resultDecimal ? `${resultInteger}.${resultDecimal}` : resultInteger;
}

/** Replaces each letter (a-z, A-Z) with a random uppercase letter; non-letters unchanged. */
export function scrambleLetters(text: string): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return text
    .split("")
    .map((char) => {
      if (char >= "a" && char <= "z")
        return letters[Math.floor(Math.random() * 26)];
      if (char >= "A" && char <= "Z")
        return letters[Math.floor(Math.random() * 26)];
      return char;
    })
    .join("");
}

/** Three dots with staggered blink animation (uses --quantum in theme). */
export function LoadingDots() {
  return (
    <span className="loading-dots" aria-hidden>
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}
