export const EPOCH_QUERY = `
  query CurrentEpoch {
    epoch {
      epochId
      startTimestamp
      endTimestamp
    }
  }
`;
