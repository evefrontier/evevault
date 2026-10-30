export interface EpochQueryResponse {
  epoch: {
    epochId: number
    startTimestamp: string | null
    endTimestamp: string | null
    /** LOCAL_DEV_EPOCH_QUERY only. */
    systemState?: {
      json?: { parameters?: { epoch_duration_ms?: string | number } }
    } | null
  } | null
}
