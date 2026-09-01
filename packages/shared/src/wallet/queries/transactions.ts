/**
 * GraphQL query for fetching transactions for an address
 * Returns transactions where the address is either sender or affected party
 *
 * Paginates backward (`last`/`before`) because the connection is ordered
 * oldest-first: `last` returns the most recent window.
 *
 * Schema reference (testnet/devnet 2025+):
 * - Address.transactions (not transactionBlocks)
 * - timestamp is on effects, not transaction
 * - BalanceChange.owner is Address (not Owner union)
 * - kind is the TransactionKind union; move-call targets come from
 *   ProgrammableTransaction.commands, used to label coin-less calls
 *   (e.g. address_alias::add) instead of a bare "System" counterparty
 */
export const TRANSACTIONS_QUERY = `
  query TransactionsForAddress(
    $address: SuiAddress!
    $last: Int
    $before: String
  ) {
    address(address: $address) {
      transactions(last: $last, before: $before, relation: AFFECTED) {
        pageInfo {
          hasPreviousPage
          startCursor
        }
        nodes {
          digest
          kind {
            __typename
            ... on ProgrammableTransaction {
              commands {
                nodes {
                  __typename
                  ... on MoveCallCommand {
                    function {
                      name
                      module {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
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
`
