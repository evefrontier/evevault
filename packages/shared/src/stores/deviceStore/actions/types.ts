import type { DeviceState } from "../../../types";

export type SetDeviceState = (
  partial:
    | Partial<DeviceState>
    | ((state: DeviceState) => Partial<DeviceState> | DeviceState),
) => void;

export type GetDeviceState = () => DeviceState;
