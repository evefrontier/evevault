import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NetworkSelector } from "./NetworkSelector";

// Mock dependencies
vi.mock("../../stores", () => ({
  useNetworkStore: vi.fn(),
}));

vi.mock("../../auth", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("../../utils", () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
  isExtension: vi.fn(() => false),
}));

import { useNetworkStore } from "../../stores";
import { useAuthStore } from "../../auth";

describe("NetworkSelector", () => {
  const mockSetChain = vi.fn();
  const mockCheckNetworkSwitch = vi.fn();
  const mockInitializeAuth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNetworkStore).mockReturnValue({
      chain: SUI_DEVNET_CHAIN,
      setChain: mockSetChain,
      checkNetworkSwitch: mockCheckNetworkSwitch,
      loading: false,
      // @ts-expect-error Partial mock
      forceSetChain: vi.fn(),
    });

    vi.mocked(useAuthStore).mockReturnValue({
      initialize: mockInitializeAuth,
      // @ts-expect-error Partial mock
      user: null,
      loading: false,
      error: null,
    });
  });

  describe("rendering", () => {
    it("displays current network", () => {
      render(<NetworkSelector chain={SUI_DEVNET_CHAIN} />);
      expect(screen.getByText(/devnet/i)).toBeVisible();
    });

    it("renders in compact mode", () => {
      render(<NetworkSelector chain={SUI_DEVNET_CHAIN} compact />);
      expect(screen.getByRole("button")).toHaveClass(
        "network-selector__badge"
      );
    });

    it("renders in expanded mode", () => {
      render(<NetworkSelector chain={SUI_DEVNET_CHAIN} />);
      expect(screen.getByRole("button")).toHaveClass(
        "network-selector__trigger"
      );
    });
  });

  describe("network dropdown", () => {
    it("opens dropdown when clicked", async () => {
      const user = userEvent.setup();
      render(<NetworkSelector chain={SUI_DEVNET_CHAIN} />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByText("Devnet")).toBeVisible();
        expect(screen.getByText("Testnet")).toBeVisible();
        expect(screen.getByText("Mainnet")).toBeVisible();
      });
    });

    it("shows checkmark for current network", async () => {
      const user = userEvent.setup();
      render(<NetworkSelector chain={SUI_DEVNET_CHAIN} />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        const devnetOption = screen.getByRole("button", { name: /devnet/i });
        expect(devnetOption.textContent).toContain("✓");
      });
    });

    it("closes dropdown when clicking outside", async () => {
      const user = userEvent.setup();
      render(
        <div>
          <NetworkSelector chain={SUI_DEVNET_CHAIN} />
          <button>Outside</button>
        </div>
      );

      await user.click(screen.getByRole("button", { name: /network/i }));
      expect(screen.getByText("Testnet")).toBeVisible();

      await user.click(screen.getByRole("button", { name: "Outside" }));

      await waitFor(() => {
        expect(screen.queryByText("Testnet")).not.toBeInTheDocument();
      });
    });
  });

  describe("seamless network switch", () => {
    it("switches network when JWT exists", async () => {
      const user = userEvent.setup();
      mockCheckNetworkSwitch.mockResolvedValue({ requiresReauth: false });
      mockSetChain.mockResolvedValue({ success: true });

      render(<NetworkSelector chain={SUI_DEVNET_CHAIN} />);

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByRole("button", { name: /testnet/i }));

      await waitFor(() => {
        expect(mockCheckNetworkSwitch).toHaveBeenCalledWith(SUI_TESTNET_CHAIN);
        expect(mockSetChain).toHaveBeenCalledWith(SUI_TESTNET_CHAIN);
      });
    });

    it("closes dropdown after seamless switch", async () => {
      const user = userEvent.setup();
      mockCheckNetworkSwitch.mockResolvedValue({ requiresReauth: false });
      mockSetChain.mockResolvedValue({ success: true });

      render(<NetworkSelector chain={SUI_DEVNET_CHAIN} />);

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByRole("button", { name: /testnet/i }));

      await waitFor(() => {
        expect(screen.queryByText("Mainnet")).not.toBeInTheDocument();
      });
    });

    it("does nothing when clicking current network", async () => {
      const user = userEvent.setup();
      render(<NetworkSelector chain={SUI_DEVNET_CHAIN} />);

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByRole("button", { name: /devnet/i }));

      await waitFor(() => {
        expect(mockCheckNetworkSwitch).not.toHaveBeenCalled();
        expect(mockSetChain).not.toHaveBeenCalled();
      });
    });
  });

  describe("network switch requiring re-auth", () => {
    it("shows confirmation dialog when re-auth required", async () => {
      const user = userEvent.setup();
      mockCheckNetworkSwitch.mockResolvedValue({ requiresReauth: true });

      render(<NetworkSelector chain={SUI_DEVNET_CHAIN} />);

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByRole("button", { name: /testnet/i }));

      await waitFor(() => {
        expect(screen.getByText("Sign In Required")).toBeVisible();
        expect(
          screen.getByText(/you haven't signed in on testnet/i)
        ).toBeVisible();
      });
    });

    it("switches and triggers re-auth when confirmed", async () => {
      const user = userEvent.setup();
      const onRequiresReauth = vi.fn();
      mockCheckNetworkSwitch.mockResolvedValue({ requiresReauth: true });

      render(
        <NetworkSelector
          chain={SUI_DEVNET_CHAIN}
          onRequiresReauth={onRequiresReauth}
        />
      );

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByRole("button", { name: /testnet/i }));

      await waitFor(() => {
        expect(screen.getByText("Sign In Required")).toBeVisible();
      });

      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(mockInitializeAuth).toHaveBeenCalled();
        expect(onRequiresReauth).toHaveBeenCalledWith(SUI_TESTNET_CHAIN);
      });
    });

    it("cancels network switch when dialog dismissed", async () => {
      const user = userEvent.setup();
      mockCheckNetworkSwitch.mockResolvedValue({ requiresReauth: true });

      render(<NetworkSelector chain={SUI_DEVNET_CHAIN} />);

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByRole("button", { name: /testnet/i }));

      await waitFor(() => {
        expect(screen.getByText("Sign In Required")).toBeVisible();
      });

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText("Sign In Required")).not.toBeInTheDocument();
      });

      expect(mockInitializeAuth).not.toHaveBeenCalled();
    });
  });

  describe("callbacks", () => {
    it("calls onNetworkSwitchStart when switching", async () => {
      const user = userEvent.setup();
      const onNetworkSwitchStart = vi.fn();
      mockCheckNetworkSwitch.mockResolvedValue({ requiresReauth: true });

      render(
        <NetworkSelector
          chain={SUI_DEVNET_CHAIN}
          onNetworkSwitchStart={onNetworkSwitchStart}
        />
      );

      await user.click(screen.getByRole("button"));
      await user.click(screen.getByRole("button", { name: /testnet/i }));

      await waitFor(() => {
        expect(screen.getByText("Sign In Required")).toBeVisible();
      });

      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(onNetworkSwitchStart).toHaveBeenCalledWith(
          SUI_DEVNET_CHAIN,
          SUI_TESTNET_CHAIN
        );
      });
    });
  });

  describe("disabled state", () => {
    it("disables when loading", () => {
      vi.mocked(useNetworkStore).mockReturnValue({
        chain: SUI_DEVNET_CHAIN,
        setChain: mockSetChain,
        checkNetworkSwitch: mockCheckNetworkSwitch,
        loading: true,
        // @ts-expect-error Partial mock
        forceSetChain: vi.fn(),
      });

      render(<NetworkSelector chain={SUI_DEVNET_CHAIN} />);

      expect(screen.getByRole("button")).toBeDisabled();
    });
  });
});
