// Global types for Enoki API responses

import type { ZkLoginInputs } from "@mysten/sui/client";

export interface EnokiError {
  message: string;
  code?: string;
  status?: number;
  details?: string;
}

export interface EnokiResponse<T> {
  data: T | undefined;
  error: EnokiError | undefined;
}

// Specific response types for different Enoki endpoints
export interface ZkLoginAddressData {
  salt: string;
  address: string;
  publicKey: string;
}

export interface ZkLoginAddressResponse
  extends EnokiResponse<ZkLoginAddressData> {}

export interface ZkProofResponse extends EnokiResponse<ZkLoginInputs> {}
