# Vend Service

> **⚠️ TEMPORARY SERVICE - DEPRECATED**
> 
> This service is a **temporary implementation** and will be **removed** once the Go-based Quasar API service is ready.
> 
> **Do not add new features or make significant changes to this service.** It exists only to provide FusionAuth vend and patch-user-nonce functionality until the production Go service is available.


A local API service that authenticates JWT tokens and proxies requests to the FusionAuth `/vend` endpoint.

## Overview

This service provides a secure way to vend JWT tokens through FusionAuth without exposing the API key to client applications. It:

1. Accepts a valid JWT token
2. Validates the token (checks expiration)
3. Makes a call to FusionAuth's `/api/jwt/vend` endpoint
4. Returns the vend result

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Environment Configuration

Create a `.env` file in the `services` directory:

```env
# FusionAuth Configuration
FUSION_SERVER_URL="https://auth.evefrontier.com"
FUSIONAUTH_API_KEY=your-fusionauth-api-key

# Server Configuration
PORT=3002
```

### 3. Run the Service

```bash
bun run dev
```

The service will start on `http://localhost:3002` (or the port specified in your `.env` file).

## API Endpoints

### POST `/vend`

Vends a new JWT token using FusionAuth.

### POST `/patch-user-nonce`

Updates a user's registration data with a nonce value in FusionAuth.

#### Request Body

```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "deviceParams": {
    "nonce": "optional-nonce-value",
    "jwtRandomness": "optional-randomness",
    "maxEpoch": "optional-max-epoch"
  }
}
```

- `id_token` (required): The JWT token to vend
- `deviceParams` (optional): Device parameters to include in the vend request

## Security Notes

- The service validates JWT tokens before making vend requests
- The FusionAuth API key is stored server-side and never exposed to clients
- CORS is enabled for all origins (adjust in production if needed)
- JWT expiration is checked before processing vend requests

