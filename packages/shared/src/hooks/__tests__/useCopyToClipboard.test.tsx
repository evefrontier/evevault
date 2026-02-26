import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "../useCopyToClipboard";

// Mock dependencies
vi.mock("../../components/Toast", () => ({
  useToast: vi.fn(),
}));

vi.mock("../../utils/address", () => ({
  copyToClipboard: vi.fn(),
}));

import { useToast } from "../../components/Toast";
import { copyToClipboard } from "../../utils/address";

describe("useCopyToClipboard", () => {
  const mockShowToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({
      showToast: mockShowToast,
      // @ts-expect-error Partial mock
      hideToast: vi.fn(),
    });
  });

  describe("successful copy", () => {
    it("calls copyToClipboard and shows success toast", async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(true);

      const { result } = renderHook(() => useCopyToClipboard());
      const success = await result.current.copy("test text");

      expect(copyToClipboard).toHaveBeenCalledWith("test text");
      expect(mockShowToast).toHaveBeenCalledWith("Copied!", 2000);
      expect(success).toBe(true);
    });

    it("uses custom success message", async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(true);

      const { result } = renderHook(() =>
        useCopyToClipboard("Address copied successfully!")
      );
      await result.current.copy("0x123456");

      expect(mockShowToast).toHaveBeenCalledWith(
        "Address copied successfully!",
        2000
      );
    });

    it("uses custom message duration", async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(true);

      const { result } = renderHook(() =>
        useCopyToClipboard("Copied!", "Failed", 5000)
      );
      await result.current.copy("test");

      expect(mockShowToast).toHaveBeenCalledWith("Copied!", 5000);
    });
  });

  describe("failed copy", () => {
    it("shows error toast when clipboard fails", async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(false);

      const { result } = renderHook(() => useCopyToClipboard());
      const success = await result.current.copy("test text");

      expect(copyToClipboard).toHaveBeenCalledWith("test text");
      expect(mockShowToast).toHaveBeenCalledWith("Failed to copy", 2000);
      expect(success).toBe(false);
    });

    it("uses custom error message", async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(false);

      const { result } = renderHook(() =>
        useCopyToClipboard("Success", "Unable to copy address")
      );
      await result.current.copy("0x123456");

      expect(mockShowToast).toHaveBeenCalledWith("Unable to copy address", 2000);
    });
  });

  describe("multiple copies", () => {
    it("handles multiple successful copies", async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(true);

      const { result } = renderHook(() => useCopyToClipboard());

      await result.current.copy("text1");
      await result.current.copy("text2");
      await result.current.copy("text3");

      expect(copyToClipboard).toHaveBeenCalledTimes(3);
      expect(mockShowToast).toHaveBeenCalledTimes(3);
    });

    it("handles mixed success and failure", async () => {
      vi.mocked(copyToClipboard)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const { result } = renderHook(() => useCopyToClipboard());

      const result1 = await result.current.copy("text1");
      const result2 = await result.current.copy("text2");
      const result3 = await result.current.copy("text3");

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(result3).toBe(true);

      expect(mockShowToast).toHaveBeenNthCalledWith(1, "Copied!", 2000);
      expect(mockShowToast).toHaveBeenNthCalledWith(2, "Failed to copy", 2000);
      expect(mockShowToast).toHaveBeenNthCalledWith(3, "Copied!", 2000);
    });
  });

  describe("default parameters", () => {
    it("uses default success message when not provided", async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(true);

      const { result } = renderHook(() => useCopyToClipboard());
      await result.current.copy("test");

      expect(mockShowToast).toHaveBeenCalledWith("Copied!", 2000);
    });

    it("uses default error message when not provided", async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(false);

      const { result } = renderHook(() => useCopyToClipboard());
      await result.current.copy("test");

      expect(mockShowToast).toHaveBeenCalledWith("Failed to copy", 2000);
    });

    it("uses default duration when not provided", async () => {
      vi.mocked(copyToClipboard).mockResolvedValue(true);

      const { result } = renderHook(() => useCopyToClipboard());
      await result.current.copy("test");

      expect(mockShowToast).toHaveBeenCalledWith("Copied!", 2000);
    });
  });
});
