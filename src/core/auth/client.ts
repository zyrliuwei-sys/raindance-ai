import { oneTapClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

const baseURL =
  typeof window !== 'undefined'
    ? window.location.origin
    : import.meta.env?.VITE_APP_URL || 'http://localhost:3000';

export const authClient = createAuthClient({ baseURL });

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
} = authClient;

export function createOneTapAuthClient(clientId: string) {
  return createAuthClient({
    baseURL,
    plugins: [oneTapClient({ clientId, promptOptions: { maxAttempts: 0 } })],
  });
}
