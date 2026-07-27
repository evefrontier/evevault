import { queryClient } from '@evevault/shared/queryClient'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { routeTree } from './routeTree.gen'
import '@evevault/shared/theme/fonts.css'
import '@evevault/shared/theme/global.css'
import { applyTheme } from '@evevault/shared/theme'
import './styles/index.css'
import { Button, ToastProvider } from '@evevault/shared/components'
import { createLogger } from '@evevault/shared/utils'

const log = createLogger()

// Apply default theme
applyTheme('dark')

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    log.error('React Error Boundary caught an error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px' }}>
          <h1>EVE Vault</h1>
          <div style={{ color: 'red' }}>
            <p>Something went wrong:</p>
            <p>{this.state.error?.message || 'Unknown error'}</p>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

// Create router instance
const router = createRouter({ routeTree })

// Register router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  )
} catch (error) {
  log.error('Failed to render app', error)
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
