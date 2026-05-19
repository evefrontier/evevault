import { DEFAULT_TENANT, TenantId } from "@evefrontier/dapp-kit";
import {
  applyTenantFromUrl,
  getCurrentTenantId,
  getDefaultTenantId,
} from "@evevault/shared";
import { runTenantSwitchCleanup } from "@evevault/shared/auth";
import { setWindowLocation } from "@evevault/shared/testing";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantUrlSync } from "../tenantUrlSync";

vi.mock("@evevault/shared", () => ({
  applyTenantFromUrl: vi.fn(),
  getCurrentTenantId: vi.fn(),
  getDefaultTenantId: vi.fn(),
}));

vi.mock("@evevault/shared/auth", () => ({
  runTenantSwitchCleanup: vi.fn(),
}));

const mockApplyTenantFromUrl = vi.mocked(applyTenantFromUrl);
const mockGetCurrentTenantId = vi.mocked(getCurrentTenantId);
const mockGetDefaultTenantId = vi.mocked(getDefaultTenantId);
const mockRunTenantSwitchCleanup = vi.mocked(runTenantSwitchCleanup);

const originalLocation = window.location;

const setMockLocation = (
  options: {
    origin?: string;
    href?: string;
    onRedirect?: (href: string) => void;
  } = {},
) => {
  const { origin = "http://localhost:3001", href = "", onRedirect } = options;
  let currentHref = href;

  Object.defineProperty(window, "location", {
    value: {
      origin,
      get href() {
        return currentHref;
      },
      set href(value: string) {
        currentHref = value;
        onRedirect?.(value);
      },
    },
    writable: true,
    configurable: true,
  });
};

const renderAndFlush = async () => {
  let result: ReturnType<typeof render> | undefined;

  await act(async () => {
    result = render(<TenantUrlSync />);
  });

  return result;
};

describe("TenantUrlSync no-change path", () => {
  beforeEach(() => {
    setMockLocation();
    mockGetCurrentTenantId.mockReturnValue(DEFAULT_TENANT);
    mockGetDefaultTenantId.mockReturnValue(DEFAULT_TENANT);
    mockApplyTenantFromUrl.mockResolvedValue({
      tenantId: DEFAULT_TENANT,
      changed: false,
    });
  });

  afterEach(() => {
    setWindowLocation(originalLocation);
    vi.clearAllMocks();
  });

  it("skips cleanup and redirect when the tenant is unchanged", async () => {
    await renderAndFlush();
    expect(mockRunTenantSwitchCleanup).not.toHaveBeenCalled();
    expect(window.location.href).toBe("");
  });

  it("reads the current tenant exactly once", async () => {
    await renderAndFlush();
    expect(mockGetCurrentTenantId).toHaveBeenCalledOnce();
  });

  it("applies the tenant from the URL exactly once", async () => {
    await renderAndFlush();
    expect(mockApplyTenantFromUrl).toHaveBeenCalledOnce();
  });
});

describe("TenantUrlSync tenant changed", () => {
  beforeEach(() => {
    setMockLocation();
    mockGetCurrentTenantId.mockReturnValue(TenantId.TAUCETI);
    mockGetDefaultTenantId.mockReturnValue(DEFAULT_TENANT);
    mockApplyTenantFromUrl.mockResolvedValue({
      tenantId: TenantId.TAUCETI,
      changed: true,
    });
  });

  afterEach(() => {
    setWindowLocation(originalLocation);
    vi.clearAllMocks();
  });

  it("cleans up the previous tenant", async () => {
    await renderAndFlush();

    expect(mockRunTenantSwitchCleanup).toHaveBeenCalledWith("tauceti");
  });

  it("redirects with a tenant query when the new tenant is not the default", async () => {
    await renderAndFlush();

    expect(window.location.href).toBe("http://localhost:3001?tenant=tauceti");
  });

  it("redirects to the origin without a query string for the default tenant", async () => {
    mockGetDefaultTenantId.mockReturnValue(TenantId.TAUCETI);

    await renderAndFlush();

    expect(window.location.href).toBe("http://localhost:3001");
  });

  it("runs cleanup before redirecting", async () => {
    const callOrder: string[] = [];
    setMockLocation({
      onRedirect: () => {
        callOrder.push("redirect");
      },
    });
    mockRunTenantSwitchCleanup.mockImplementation(async () => {
      callOrder.push("cleanup");
    });

    await renderAndFlush();

    expect(callOrder).toEqual(["cleanup", "redirect"]);
  });
});

describe("TenantUrlSync didRun guard", () => {
  beforeEach(() => {
    setMockLocation();
    mockGetCurrentTenantId.mockReturnValue(DEFAULT_TENANT);
    mockGetDefaultTenantId.mockReturnValue(DEFAULT_TENANT);
    mockApplyTenantFromUrl.mockResolvedValue({
      tenantId: DEFAULT_TENANT,
      changed: false,
    });
  });

  afterEach(() => {
    setWindowLocation(originalLocation);
    vi.clearAllMocks();
  });

  it("applies the URL tenant only once across re-renders of the same instance", async () => {
    const result = await renderAndFlush();

    await act(async () => {
      result?.rerender(<TenantUrlSync />);
    });

    expect(mockApplyTenantFromUrl).toHaveBeenCalledOnce();
  });

  it("applies the URL tenant once per mount instance", async () => {
    const first = await renderAndFlush();
    first?.unmount();

    await renderAndFlush();

    expect(mockApplyTenantFromUrl).toHaveBeenCalledTimes(2);
  });
});

describe("TenantUrlSync render output", () => {
  beforeEach(() => {
    setMockLocation();
    mockGetCurrentTenantId.mockReturnValue(DEFAULT_TENANT);
    mockGetDefaultTenantId.mockReturnValue(DEFAULT_TENANT);
    mockApplyTenantFromUrl.mockResolvedValue({
      tenantId: DEFAULT_TENANT,
      changed: false,
    });
  });

  afterEach(() => {
    setWindowLocation(originalLocation);
    vi.clearAllMocks();
  });

  it("renders null", async () => {
    const result = await renderAndFlush();

    expect(result?.container.firstChild).toBeNull();
  });
});
