// Single source of truth lives in @evevault/shared/wallet so the signing-layer
// backstop (signForChain) and this UI gate share one detection rule. Re-exported
// here to keep the existing feature-local import path and test mocks stable.
export {
  ADDRESS_ALIAS_SIGNING_BLOCKED,
  transactionContainsAddressAliasCall,
} from '@evevault/shared/wallet/aliasCall'
