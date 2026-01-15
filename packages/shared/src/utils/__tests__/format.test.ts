import { describe, expect, it } from "vitest";
import {
  formatByDecimals,
  formatDisplayAmount,
  formatShortDate,
  toSmallestUnit,
} from "../format";

describe("toSmallestUnit", () => {
  const DECIMALS = 9; // SUI uses 9 decimals

  describe("basic conversions", () => {
    it("converts whole numbers", () => {
      expect(toSmallestUnit("1", DECIMALS)).toBe(1_000_000_000n);
      expect(toSmallestUnit("10", DECIMALS)).toBe(10_000_000_000n);
      expect(toSmallestUnit("100", DECIMALS)).toBe(100_000_000_000n);
    });

    it("converts decimal numbers", () => {
      expect(toSmallestUnit("1.5", DECIMALS)).toBe(1_500_000_000n);
      expect(toSmallestUnit("0.1", DECIMALS)).toBe(100_000_000n);
      expect(toSmallestUnit("0.000000001", DECIMALS)).toBe(1n);
    });

    it("handles leading decimal point", () => {
      expect(toSmallestUnit(".5", DECIMALS)).toBe(500_000_000n);
      expect(toSmallestUnit(".123456789", DECIMALS)).toBe(123_456_789n);
    });

    it("handles zero", () => {
      expect(toSmallestUnit("0", DECIMALS)).toBe(0n);
      expect(toSmallestUnit("0.0", DECIMALS)).toBe(0n);
      expect(toSmallestUnit("0.000000000", DECIMALS)).toBe(0n);
    });
  });

  describe("edge cases", () => {
    it("returns 0n for empty string", () => {
      expect(toSmallestUnit("", DECIMALS)).toBe(0n);
    });

    it("returns 0n for just a decimal point", () => {
      expect(toSmallestUnit(".", DECIMALS)).toBe(0n);
    });

    it("handles large numbers", () => {
      expect(toSmallestUnit("1000000", DECIMALS)).toBe(1_000_000_000_000_000n);
    });

    it("handles maximum precision", () => {
      expect(toSmallestUnit("1.123456789", DECIMALS)).toBe(1_123_456_789n);
    });

    it("handles fewer decimals than maximum", () => {
      expect(toSmallestUnit("1.1", DECIMALS)).toBe(1_100_000_000n);
      expect(toSmallestUnit("1.12", DECIMALS)).toBe(1_120_000_000n);
    });
  });

  describe("error handling", () => {
    it("throws when too many decimal places", () => {
      expect(() => toSmallestUnit("1.1234567890", DECIMALS)).toThrow(
        "Amount has too many decimal places. Maximum allowed is 9.",
      );
    });

    it("throws for different decimal configurations", () => {
      // Token with 6 decimals (like USDC)
      expect(() => toSmallestUnit("1.1234567", 6)).toThrow(
        "Maximum allowed is 6",
      );
    });
  });

  describe("different decimal configurations", () => {
    it("works with 6 decimals (USDC-like)", () => {
      expect(toSmallestUnit("1", 6)).toBe(1_000_000n);
      expect(toSmallestUnit("1.5", 6)).toBe(1_500_000n);
      expect(toSmallestUnit("0.000001", 6)).toBe(1n);
    });

    it("works with 18 decimals (ETH-like)", () => {
      expect(toSmallestUnit("1", 18)).toBe(1_000_000_000_000_000_000n);
      expect(toSmallestUnit("0.1", 18)).toBe(100_000_000_000_000_000n);
    });
  });
});

describe("formatByDecimals", () => {
  const DECIMALS = 9;

  describe("basic formatting", () => {
    it("formats whole numbers", () => {
      expect(formatByDecimals("1000000000", DECIMALS)).toBe("1");
      expect(formatByDecimals("10000000000", DECIMALS)).toBe("10");
    });

    it("formats decimal numbers", () => {
      expect(formatByDecimals("1500000000", DECIMALS)).toBe("1.5");
      expect(formatByDecimals("1234567890", DECIMALS)).toBe("1.23456789");
    });

    it("formats zero", () => {
      expect(formatByDecimals("0", DECIMALS)).toBe("0");
    });

    it("formats small amounts", () => {
      expect(formatByDecimals("1", DECIMALS)).toBe("0.000000001");
      expect(formatByDecimals("100000000", DECIMALS)).toBe("0.1");
    });
  });

  describe("trailing zero handling", () => {
    it("removes trailing zeros from fraction", () => {
      expect(formatByDecimals("1100000000", DECIMALS)).toBe("1.1");
      expect(formatByDecimals("1120000000", DECIMALS)).toBe("1.12");
    });
  });
});

describe("round-trip conversion", () => {
  const DECIMALS = 9;

  it("toSmallestUnit → formatByDecimals returns original value", () => {
    const testCases = ["1", "1.5", "0.1", "123.456789", "0.000000001"];

    for (const original of testCases) {
      const smallest = toSmallestUnit(original, DECIMALS);
      const formatted = formatByDecimals(smallest.toString(), DECIMALS);
      expect(formatted).toBe(original);
    }
  });

  it("formatByDecimals → toSmallestUnit returns original value", () => {
    const testCases = [
      "1000000000",
      "1500000000",
      "100000000",
      "123456789000",
      "1",
    ];

    for (const original of testCases) {
      const formatted = formatByDecimals(original, DECIMALS);
      const smallest = toSmallestUnit(formatted, DECIMALS);
      expect(smallest.toString()).toBe(original);
    }
  });
});

describe("formatShortDate", () => {
  it("returns a non-empty string for valid timestamps", () => {
    const timestamp = new Date("2024-01-01T00:00:00Z").getTime();
    const result = formatShortDate(timestamp);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("includes year in 2-digit format", () => {
    const timestamp = new Date("2024-03-05T12:00:00Z").getTime();
    const result = formatShortDate(timestamp);
    // Should contain "24" for year 2024
    expect(result).toContain("24");
  });

  it("formats consistently for the same timestamp", () => {
    const timestamp = new Date("2024-12-25T00:00:00Z").getTime();
    const result1 = formatShortDate(timestamp);
    const result2 = formatShortDate(timestamp);
    expect(result1).toBe(result2);
  });

  it("handles different years correctly", () => {
    const timestamp2025 = new Date("2025-06-15T12:00:00Z").getTime();
    const timestamp2030 = new Date("2030-06-15T12:00:00Z").getTime();

    expect(formatShortDate(timestamp2025)).toContain("25");
    expect(formatShortDate(timestamp2030)).toContain("30");
  });

  it("produces locale-formatted output using Intl.DateTimeFormat", () => {
    const timestamp = new Date("2024-07-04T12:00:00Z").getTime();
    const result = formatShortDate(timestamp);

    // The result should match what Intl.DateTimeFormat produces
    const expected = new Intl.DateTimeFormat(undefined, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(timestamp));

    expect(result).toBe(expected);
  });
});

describe("formatDisplayAmount", () => {
  it("limits decimal places to 5 by default", () => {
    const result = formatDisplayAmount("1.123456789");
    // Should have at most 5 decimals
    const decimalPart = result.split(/[.,]/)[1] || "";
    expect(decimalPart.length).toBeLessThanOrEqual(5);
  });

  it("respects custom maxDecimals parameter", () => {
    const result = formatDisplayAmount("1.123456789", 3);
    const decimalPart = result.split(/[.,]/)[1] || "";
    expect(decimalPart.length).toBeLessThanOrEqual(3);
  });

  it("handles whole numbers", () => {
    const result = formatDisplayAmount("1000000");
    // Should contain the number 1000000 with locale formatting
    expect(result).toBeTruthy();
    // Remove separators and check value
    const numValue = Number.parseFloat(result.replace(/[^0-9.-]/g, ""));
    expect(numValue).toBe(1000000);
  });

  it("handles small decimals", () => {
    const result = formatDisplayAmount("0.00100988");
    expect(result).toBeTruthy();
  });

  it("returns placeholder for invalid numbers", () => {
    expect(formatDisplayAmount("invalid")).toBe("—");
  });

  it("produces locale-formatted output using Intl.NumberFormat", () => {
    const result = formatDisplayAmount("1234567.12345");

    // The result should match what Intl.NumberFormat produces
    const expected = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 5,
    }).format(1234567.12345);

    expect(result).toBe(expected);
  });
});
