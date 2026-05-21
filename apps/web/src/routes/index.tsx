import { useAuthStore, waitForAuthHydration } from '@evevault/shared/auth';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginScreen } from '@/features/auth/components/LoginScreen';
import { resolveRoute, validateSearch } from '@/lib/routeUtils';

export const Route = createFileRoute('/')({
  validateSearch,
  beforeLoad: async ({ search }) => {
    document.title = 'EVE Vault - Sign In';
    await waitForAuthHydration(); // TODO(dev-auth): remove when real login is available

    // If user is already authenticated, redirect to wallet or intended destination
    const user = useAuthStore.getState().user;
    if (user) {
      const redirectTo = resolveRoute(search.redirect);
      throw redirect({
        to: redirectTo,
      });
    }
  },
  component: LoginScreen,
});
