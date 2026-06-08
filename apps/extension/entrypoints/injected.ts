import { registerInjectedWallet } from '../src/lib/adapters/SuiWallet/injectedWalletRegistration'

export default defineUnlistedScript(() => {
  // Wait a bit for the wallet standard to be ready
  setTimeout(registerInjectedWallet, 100)
})
