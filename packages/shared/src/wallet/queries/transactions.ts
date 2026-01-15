/**
 * GraphQL query for fetching transactions for an address
 * Returns transactions where the address is either sender or affected party
 *
 * Schema reference (testnet/devnet 2025+):
 * - Address.transactions (not transactionBlocks)
 * - timestamp is on effects, not transaction
 * - BalanceChange.owner is Address (not Owner union)
 */
export const TRANSACTIONS_QUERY = `
  query TransactionsForAddress(
    $address: SuiAddress!
    $first: Int
    $after: String
  ) {
    address(address: $address) {
      transactions(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          digest
          effects {
            timestamp
            balanceChanges {
              nodes {
                amount
                coinType {
                  repr
                }
                owner {
                  address
                }
              }
            }
          }
        }
      }
    }
  }
`;
