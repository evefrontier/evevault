import { Layout, ToastProvider } from '@evevault/shared/components'
import { queryClient } from '@evevault/shared/queryClient'
import { QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentType } from 'react'
import ReactDOM from 'react-dom/client'

export function renderSignPopup(Component: ComponentType) {
  const root = document.getElementById('root')
  if (!root) {
    throw new Error('Root element not found')
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Layout variant="extension" showNav={false}>
            <Component />
          </Layout>
        </ToastProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  )
}
