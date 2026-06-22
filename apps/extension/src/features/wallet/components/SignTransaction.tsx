import { SignTransactionFlow } from './SignTransactionFlow'

function SignTransaction() {
  return (
    <SignTransactionFlow
      title="Sign Transaction"
      onSign={async ({ bytes, signature }, storeResult) => {
        const stored = await storeResult({ status: 'signed', bytes, signature })
        // A refused write (e.g. missing requestId) must surface as an error so
        // withSigning skips window.close() and the dApp request isn't stranded.
        if (!stored) {
          throw new Error(
            'Failed to record the signing result. Please try again.',
          )
        }
      }}
    />
  )
}

export default SignTransaction
