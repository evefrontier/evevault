import { WalletActions } from '@evevault/shared'
import { Layout, ToastProvider } from '@evevault/shared/components'
import { queryClient } from '@evevault/shared/queryClient'
import { applyTheme } from '@evevault/shared/theme'
import { createLogger } from '@evevault/shared/utils'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import React from 'react'
import ReactDOM from 'react-dom/client'
import SignAndExecuteTransaction from '@/features/wallet/components/SignExecuteTransaction'
import SignPersonalMessage from '@/features/wallet/components/SignPersonalMessage'
import SignTransaction from '@/features/wallet/components/SignTransaction'
import { routeTree } from '@/routeTree.gen'
import '../style.css'

const log = createLogger()

// Apply default theme
applyTheme('dark')

// Create hash history for extension (required for chrome-extension:// URLs)
const hashHistory = createHashHistory()

// Create router instance with hash history
const router = createRouter({
  routeTree,
  history: hashHistory,
})

function getComponent() {
  const path = window.location.pathname
  const htmlFile = path.split('/').pop() || ''
  const action = htmlFile.split('.')[0]

  switch (action) {
    case WalletActions.SIGN_PERSONAL_MESSAGE:
      return <SignPersonalMessage />
    case WalletActions.SIGN_TRANSACTION:
      return <SignTransaction />
    case WalletActions.SIGN_AND_EXECUTE_TRANSACTION:
      return <SignAndExecuteTransaction />
    default:
      return <RouterProvider router={router} />
  }
}

// Register router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Layout variant="extension" showNav={false}>
            {getComponent()}
          </Layout>
        </ToastProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  )
} catch (error) {
  log.error('Failed to render popup entrypoint', error)
  // Built via DOM APIs (not innerHTML) so the error message is inert text —
  // also keeps this compatible with require-trusted-types-for 'script'.
  const container = document.createElement('div')
  container.style.padding = '20px'
  const heading = document.createElement('h1')
  heading.textContent = 'EVE Vault'
  const message = document.createElement('p')
  message.style.color = 'red'
  message.textContent = `Failed to initialize: ${
    error instanceof Error ? error.message : String(error)
  }`
  const reloadButton = document.createElement('button')
  reloadButton.textContent = 'Reload'
  reloadButton.addEventListener('click', () => window.location.reload())
  container.append(heading, message, reloadButton)
  rootElement.replaceChildren(container)
}
