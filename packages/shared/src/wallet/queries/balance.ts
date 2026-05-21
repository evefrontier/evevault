/**
 * GraphQL query for the latest checkpoint (no args = latest).
 * Used to pin balance queries to a checkpoint inside the RPC's consistent range.
 */
export const LATEST_CHECKPOINT_QUERY = `
  query LatestCheckpoint {
    checkpoint {
      sequenceNumber
    }
  }
`

/**
 * GraphQL query for fetching address balance and coin metadata in one request.
 * Pass atCheckpoint (from LatestCheckpoint) to avoid "Request is outside consistent range".
 */
export const BALANCE_AND_METADATA_QUERY = `
  query BalanceAndMetadata($address: SuiAddress!, $coinType: String!, $atCheckpoint: UInt53) {
    address(address: $address, atCheckpoint: $atCheckpoint) {
      balance(coinType: $coinType) {
        totalBalance
      }
    }
    coinMetadata(coinType: $coinType) {
      decimals
      name
      symbol
      description
      iconUrl
    }
  }
`
