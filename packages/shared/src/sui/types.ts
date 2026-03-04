export interface EpochQueryResponse {
  epoch: {
    epochId: number;
    startTimestamp: string | null;
    endTimestamp: string | null;
  } | null;
}
