import type { DeviceState } from '#/types'
import { getZkProofForChain } from './proofHelpers'
import type { GetDeviceState, SetDeviceState } from './types'

export function createProofActions(set: SetDeviceState, get: GetDeviceState) {
  return {
    getZkProof: async (currentChain) => {
      return getZkProofForChain(currentChain, set, get)
    },
  } satisfies Pick<DeviceState, 'getZkProof'>
}
