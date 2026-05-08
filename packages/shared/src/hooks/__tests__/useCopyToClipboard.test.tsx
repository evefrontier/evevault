import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCopyToClipboard, mockShowToast } = vi.hoisted(() => ({
  mockCopyToClipboard: vi.fn(),
  mockShowToast: vi.fn(),
}));

vi.mock("#/utils/address", () => ({
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
}));

vi.mock("#/components/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

import { useCopyToClipboard } from "#/hooks/useCopyToClipboard";

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a copy function that calls copyToClipboard with text", async () => {
    mockCopyToClipboard.mockResolvedValue(true);
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("0xabc");
    });

    expect(mockCopyToClipboard).toHaveBeenCalledWith("0xabc");
  });

  it("shows the success toast with the custom successMessage on success", async () => {
    mockCopyToClipboard.mockResolvedValue(true);
    const { result } = renderHook(() =>
      useCopyToClipboard("Copied address", "Copy failed", 4500),
    );

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.copy("0xabc");
    });

    expect(success).toBe(true);
    expect(mockShowToast).toHaveBeenCalledWith("Copied address", 4500);
  });

  it("shows the error toast with the custom errorMessage on failure", async () => {
    mockCopyToClipboard.mockResolvedValue(false);
    const { result } = renderHook(() =>
      useCopyToClipboard("Copied address", "Copy failed", 4500),
    );

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.copy("0xabc");
    });

    expect(success).toBe(false);
    expect(mockShowToast).toHaveBeenCalledWith("Copy failed", 4500);
  });
});
