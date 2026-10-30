export const EPOCH_QUERY = `
  query CurrentEpoch {
    epoch {
      epochId
      startTimestamp
      endTimestamp
    }
  }
`

/** LOCAL_DEV: the same, plus the system state, for the chain's epoch length. */
export const LOCAL_DEV_EPOCH_QUERY = `
  query CurrentEpochLocalDev {
    epoch {
      epochId
      startTimestamp
      endTimestamp
      systemState {
        json
      }
    }
  }
`
