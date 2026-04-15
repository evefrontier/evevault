import { User } from "oidc-client-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetZkLoginAddress = vi.fn();
const mockStoreJwt = vi.fn();
const mockWarn = vi.fn();

vi.mock("../getZkLoginAddress", () => ({
  getZkLoginAddress: (...args: unknown[]) => mockGetZkLoginAddress(...args),
}));

vi.mock("../storageService", () => ({
  storeJwt: (...args: unknown[]) => mockStoreJwt(...args),
}));

vi.mock("../../utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockWarn,
    error: vi.fn(),
  }),
}));

function makeJwtPayload(claims: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
}

function baseUser(overrides: Partial<ConstructorParameters<typeof User>[0]>) {
  return new User({
    id_token: makeJwtPayload({ sub: "user-1", exp: 4_000_000_000 }),
    access_token: "access",
    token_type: "Bearer",
    scope: "openid",
    refresh_token: "refresh-1",
    profile: { sub: "user-1" } as User["profile"],
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  });
}

describe("enrichUserWithZkLoginIfNeeded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the same user when id_token is missing", async () => {
    const { enrichUserWithZkLoginIfNeeded } = await import("../userJwtSync");
    const user = baseUser({ id_token: undefined });

    const out = await enrichUserWithZkLoginIfNeeded(user, () => "enoki-key");

    expect(out).toBe(user);
    expect(mockGetZkLoginAddress).not.toHaveBeenCalled();
  });

  it("returns the same user when profile.sui_address is already set", async () => {
    const { enrichUserWithZkLoginIfNeeded } = await import("../userJwtSync");
    const user = baseUser({
      profile: {
        sub: "user-1",
        sui_address: "0xsui",
      } as unknown as User["profile"],
    });

    const out = await enrichUserWithZkLoginIfNeeded(user, () => "enoki-key");

    expect(out).toBe(user);
    expect(mockGetZkLoginAddress).not.toHaveBeenCalled();
  });

  it("calls Enoki and merges sui_address and salt when sui_address is missing", async () => {
    const { enrichUserWithZkLoginIfNeeded } = await import("../userJwtSync");
    mockGetZkLoginAddress.mockResolvedValue({
      data: { address: "0xenoki", salt: "salt-99" },
      error: undefined,
    });

    const user = baseUser({
      profile: { sub: "user-1" } as User["profile"],
    });

    const out = await enrichUserWithZkLoginIfNeeded(user, () => "enoki-key");

    expect(mockGetZkLoginAddress).toHaveBeenCalledWith({
      jwt: user.id_token,
      enokiApiKey: "enoki-key",
    });
    expect(out).not.toBe(user);
    expect(out.profile?.sui_address).toBe("0xenoki");
    expect(out.profile?.salt).toBe("salt-99");
  });

  it("throws when Enoki returns an error", async () => {
    const { enrichUserWithZkLoginIfNeeded } = await import("../userJwtSync");
    mockGetZkLoginAddress.mockResolvedValue({
      data: undefined,
      error: { message: "Enoki down" },
    });

    const user = baseUser({});

    await expect(
      enrichUserWithZkLoginIfNeeded(user, () => "k"),
    ).rejects.toThrow("Enoki down");
  });
});

describe("syncPrimaryJwtFromUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("warns and skips storeJwt when refresh_token is missing", async () => {
    const { syncPrimaryJwtFromUser } = await import("../userJwtSync");
    const user = baseUser({ refresh_token: undefined });

    await syncPrimaryJwtFromUser(user);

    expect(mockWarn).toHaveBeenCalledWith(
      "[syncPrimaryJwtFromUser] no refresh token, skipping evevault:jwt mirror",
    );
    expect(mockStoreJwt).not.toHaveBeenCalled();
  });

  it("warns and skips storeJwt when refresh_token is blank", async () => {
    const { syncPrimaryJwtFromUser } = await import("../userJwtSync");
    const user = baseUser({ refresh_token: "   " });

    await syncPrimaryJwtFromUser(user);

    expect(mockWarn).toHaveBeenCalled();
    expect(mockStoreJwt).not.toHaveBeenCalled();
  });

  it("calls storeJwt with OAuth payload when refresh_token is present", async () => {
    const { syncPrimaryJwtFromUser } = await import("../userJwtSync");
    const user = baseUser({});

    await syncPrimaryJwtFromUser(user);

    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockStoreJwt).toHaveBeenCalledTimes(1);
    const [jwtArg] = mockStoreJwt.mock.calls[0] ?? [];
    expect(jwtArg).toMatchObject({
      id_token: user.id_token,
      access_token: "access",
      refresh_token: "refresh-1",
    });
  });
});
