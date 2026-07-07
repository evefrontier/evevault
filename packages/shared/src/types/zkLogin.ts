// Global types for zkLogin API responses

import type { ZkLoginSignatureInputs } from '@mysten/sui/zklogin'

export interface ApiError {
  message: string
  code?: string
  status?: number
  details?: string
}

export interface ApiResponse<T> {
  data: T | undefined
  error: ApiError | undefined
}

// Specific response types for different zkLogin endpoints
export interface ZkLoginAddressData {
  salt: string
  address: string
  publicKey: string
}

export type ZkProofData = ZkLoginSignatureInputs

export interface ZkProofResponse extends ApiResponse<ZkProofData> {}
