import type { DeviceState } from '#/types'
import { lockDevice, resetDevice, unlockDevice } from './lockHelpers'
import type { GetDeviceState, SetDeviceState } from './types'

export function createLockActions(set: SetDeviceState, get: GetDeviceState) {
  return {
    lock: async () => {
      await lockDevice(set)
    },

    unlock: async (pin: string) => {
      await unlockDevice(pin, set, get)
    },

    reset: () => {
      resetDevice(set)
    },
  } satisfies Pick<DeviceState, 'lock' | 'unlock' | 'reset'>
}
