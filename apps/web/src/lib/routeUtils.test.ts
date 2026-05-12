import { FILE_ROUTE_PATHS } from "@evevault/shared/utils";
import { describe, expect, it } from "vitest";
import {
  getOptionalString,
  isRoutePath,
  resolveRoute,
  validateSearch,
} from "./routeUtils";

describe("getOptionalString", () => {
  it.each([
    ["string", "wallet", "wallet"],
    ["empty string", "", ""],
    ["number", 1, undefined],
    ["boolean", true, undefined],
    ["null", null, undefined],
    ["undefined", undefined, undefined],
    ["object", { redirect: "/wallet" }, undefined],
    ["array", ["/wallet"], undefined],
    ["function", () => "/wallet", undefined],
  ])("returns the expected value for %s", (_label, value, expected) => {
    expect(getOptionalString(value)).toBe(expected);
  });
});

describe("validateSearch", () => {
  it.each([
    ["missing key", {}, { redirect: undefined }],
    ["string redirect", { redirect: "/wallet" }, { redirect: "/wallet" }],
    ["empty string redirect", { redirect: "" }, { redirect: "" }],
    ["number redirect", { redirect: 1 }, { redirect: undefined }],
    ["null redirect", { redirect: null }, { redirect: undefined }],
    ["boolean redirect", { redirect: false }, { redirect: undefined }],
    ["undefined redirect", { redirect: undefined }, { redirect: undefined }],
    ["unrelated keys", { tenant: "tauceti" }, { redirect: undefined }],
    [
      "extra keys",
      { redirect: "/wallet", tenant: "tauceti" },
      { redirect: "/wallet" },
    ],
  ])("sanitizes %s", (_label, search, expected) => {
    expect(validateSearch(search)).toEqual(expected);
  });
});

describe("isRoutePath", () => {
  it.each(FILE_ROUTE_PATHS)("returns true for %s", (path) => {
    expect(isRoutePath(path)).toBe(true);
  });

  it.each([
    "",
    "wallet",
    "/wallet/",
    "/Wallet",
    " /wallet",
    "/unknown",
  ])("returns false for %s", (path) => {
    expect(isRoutePath(path)).toBe(false);
  });
});

describe("resolveRoute", () => {
  it.each([
    ["undefined", undefined, "/wallet"],
    ["empty string", "", "/wallet"],
    ...FILE_ROUTE_PATHS.map((path) => [path, path, path] as const),
    ["unknown path", "/unknown", "/wallet"],
    ["absolute URL", "https://example.com/wallet", "/wallet"],
  ])("resolves %s", (_label, target, expected) => {
    expect(resolveRoute(target)).toBe(expected);
  });
});
