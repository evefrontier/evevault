import { SignTransactionFlow } from './SignTransactionFlow'

function SignTransaction() {
  return (
    <SignTransactionFlow
      title="Sign Transaction"
      onSign={async ({ bytes, signature, windowId }) => {
        await chrome.storage.local.set({
          transactionResult: { windowId, status: 'signed', bytes, signature },
        })
      }}
    />
  )
}

export default SignTransaction
