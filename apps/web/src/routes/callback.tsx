import { createFileRoute } from '@tanstack/react-router'
import { CallbackScreen } from '@/features/auth/components/CallbackScreen'

type CallbackSearch = {
  code?: string
  error?: string
}

const getOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

const validateSearch = (search: Record<string, unknown>): CallbackSearch => ({
  code: getOptionalString(search.code),
  error: getOptionalString(search.error),
})

export const Route = createFileRoute('/callback')({
  beforeLoad: () => {
    document.title = 'EVE Vault - Authenticating'
  },
  component: CallbackScreen,
  validateSearch,
})
