/**
 * GraphQL query for fetching address balance and coin metadata in one request.
 * Uses Sui GraphQL: address.balance(coinType) for one coin type, coinMetadata(coinType).
 * See https://docs.sui.io/references/sui-api/sui-graphql/beta/reference/types/objects/address
 */
export const BALANCE_AND_METADATA_QUERY = `
  query BalanceAndMetadata($address: SuiAddress!, $coinType: String!) {
    address(address: $address) {
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
`;
