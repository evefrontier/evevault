/**
 * ⚠️ TEMPORARY SERVICE - DEPRECATED
 *
 * This service is a temporary implementation that will be removed once the
 * Go-based Quasar API service is ready. It provides:
 * - JWT vend functionality via FusionAuth
 * - User nonce patching via FusionAuth
 *
 * DO NOT add new features or make significant changes.
 * This service exists only as a stopgap until the production Go service is available.
 *
 * @deprecated This entire service will be removed in favor of a Go service
 */

import { decodeJwt } from "jose";

declare const Bun: {
  env: Record<string, string | undefined>;
  serve: (options: {
    port: number;
    fetch: (req: Request) => Promise<Response>;
  }) => { port: number };
};

interface VendRequest {
  id_token: string;
  deviceParams?: {
    nonce?: string;
    jwtRandomness?: string;
    maxEpoch?: string;
  };
}

interface VendResponse {
  success: boolean;
  token?: string;
  error?: string;
}

interface PatchUserNonceRequest {
  id_token: string;
  registrationId: string;
  applicationId?: string;
  nonce: string;
}

interface PatchUserNonceResponse {
  success: boolean;
  error?: string;
}

const PORT = Bun.env.PORT ? parseInt(Bun.env.PORT, 10) : 3002;
const FUSIONAUTH_API_KEY = Bun.env.FUSIONAUTH_API_KEY;
const FUSION_SERVER_URL = Bun.env.FUSION_SERVER_URL;

if (!FUSIONAUTH_API_KEY) {
  throw new Error(
    "FUSIONAUTH_API_KEY environment variable is required. Set it in your .env file.",
  );
}

if (!FUSION_SERVER_URL) {
  throw new Error(
    "FUSION_SERVER_URL environment variable is required. Set it in your .env file.",
  );
}

const VEND_URL = `${FUSION_SERVER_URL.replace(/\/$/, "")}/api/jwt/vend`;
const FUSIONAUTH_APPLICATION_ID =
  Bun.env.FUSIONAUTH_APPLICATION_ID || "f53766b7-fc37-4ed8-90e1-ce1968c146b2";

async function validateJwt(token: string): Promise<boolean> {
  try {
    const decoded = decodeJwt(token);

    if (!decoded.exp) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now >= decoded.exp) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function vendToken(
  token: string,
  deviceParams?: VendRequest["deviceParams"],
): Promise<string> {
  const existingClaims = decodeJwt(token);

  const requestBody: Record<string, unknown> = {
    claims: {
      ...existingClaims,
      ...(deviceParams?.nonce && { nonce: deviceParams.nonce }),
    },
  };

  const response = await fetch(VEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: FUSIONAUTH_API_KEY,
      Accept: "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JWT vend failed: ${errorText}`);
  }

  const result = await response.json();

  if (!result.token) {
    throw new Error("Vend response missing token");
  }

  return result.token;
}

async function patchUserNonce(
  registrationId: string,
  applicationId: string,
  nonce: string,
): Promise<void> {
  const patchUrl = `${FUSION_SERVER_URL.replace(
    /\/$/,
    "",
  )}/api/user/registration/${registrationId}`;

  const requestBody = {
    registration: {
      applicationId,
      data: {
        nonce,
      },
    },
  };

  const response = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: FUSIONAUTH_API_KEY,
      Accept: "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("PATCH user nonce failed", errorText);
    throw new Error(`PATCH user nonce failed: ${errorText}`);
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const url = new URL(req.url);

    if (url.pathname === "/vend") {
      return handleVendRequest(req);
    }

    if (url.pathname === "/patch-user-nonce") {
      return handlePatchUserNonceRequest(req);
    }

    return new Response(
      JSON.stringify({ success: false, error: "Not found" }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  },
});

async function handleVendRequest(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as VendRequest;

    if (!body.id_token) {
      const errorResponse: VendResponse = {
        success: false,
        error: "Missing id_token in request body",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const isValid = await validateJwt(body.id_token);

    if (!isValid) {
      const errorResponse: VendResponse = {
        success: false,
        error: "Invalid or expired JWT token",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const vendResult = await vendToken(body.id_token, body.deviceParams);

    const successResponse: VendResponse = {
      success: true,
      token: vendResult,
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const errorResponse: VendResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

async function handlePatchUserNonceRequest(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as PatchUserNonceRequest;

    console.log("Patch user nonce request body", body);

    if (!body.id_token) {
      const errorResponse: PatchUserNonceResponse = {
        success: false,
        error: "Missing id_token in request body",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (!body.registrationId) {
      const errorResponse: PatchUserNonceResponse = {
        success: false,
        error: "Missing registrationId in request body",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (!body.nonce) {
      const errorResponse: PatchUserNonceResponse = {
        success: false,
        error: "Missing nonce in request body",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const isValid = await validateJwt(body.id_token);

    if (!isValid) {
      const errorResponse: PatchUserNonceResponse = {
        success: false,
        error: "Invalid or expired JWT token",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const applicationId = body.applicationId || FUSIONAUTH_APPLICATION_ID;

    await patchUserNonce(body.registrationId, applicationId, body.nonce);

    const successResponse: PatchUserNonceResponse = {
      success: true,
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    const errorResponse: PatchUserNonceResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

console.log(`Vend service running on http://localhost:${PORT}`);
console.log(`Endpoints:`);
console.log(`  POST http://localhost:${PORT}/vend`);
console.log(`  POST http://localhost:${PORT}/patch-user-nonce`);
