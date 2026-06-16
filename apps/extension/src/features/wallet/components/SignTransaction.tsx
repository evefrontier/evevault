import { SignTransactionFlow } from './SignTransactionFlow'

function SignTransaction() {
  return (
    <SignTransactionFlow
      title="Sign Transaction"
      onSign={async ({ bytes, signature }, storeResult) => {
        await storeResult({ status: 'signed', bytes, signature })
      }}
    />
  )
}

export default SignTransaction
