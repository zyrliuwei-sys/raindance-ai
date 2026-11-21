import { useState } from 'react';

import { signIn } from '@/core/auth/client';
import { authCallbackUrl } from '@/lib/redirect';
import { m } from '@/paraglide/messages.js';

export function useSocialSignIn(setError: (message: string) => void) {
  const [socialSignInPending, setSocialSignInPending] = useState(false);

  async function signInWithProvider(
    provider: 'google' | 'github',
    callbackPath: string
  ) {
    if (socialSignInPending) return;
    setSocialSignInPending(true);
    setError('');

    try {
      const result = await signIn.social({
        provider,
        callbackURL: authCallbackUrl(callbackPath),
      });
      if (result.data?.url) return;
    } catch {
      // Handle network failures through the same retry message.
    } finally {
      setSocialSignInPending(false);
    }

    setError(m['common.sign.social_sign_in_failed']());
  }

  return { signInWithProvider, socialSignInPending };
}
