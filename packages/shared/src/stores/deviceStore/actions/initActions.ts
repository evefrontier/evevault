import type { SuiChain } from '@mysten/wallet-standard'
import type { DeviceState } from '#/types'
import {
  initializeDeviceStore,
  initializeForChainData,
  rotateEphemeralKeyForChain,
} from './initHelpers'
import type { GetDeviceState, SetDeviceState } from './types'

export function createInitActions(set: SetDeviceState, get: GetDeviceState) {
  return {
    initialize: async (pin: string, currentChain: SuiChain) => {
      await initializeDeviceStore({ pin, currentChain, set, get })
    },

    initializeForChain: async (chain: SuiChain) => {
      await initializeForChainData(chain, set, get)
    },

    rotateEphemeralKey: async (currentChain: SuiChain) => {
      await rotateEphemeralKeyForChain(currentChain, set, get)
    },
  } satisfies Pick<
    DeviceState,
    'initialize' | 'initializeForChain' | 'rotateEphemeralKey'
  >
}
