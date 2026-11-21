import { useEffect, useRef } from 'react';

import { createOneTapAuthClient, useSession } from '@/core/auth/client';
import { authCallbackUrl, resolveAfterAuthUrl } from '@/lib/redirect';
import { deLocalizeHref } from '@/paraglide/runtime.js';
import { usePublicConfig } from '@/hooks/use-public-config';

function finishOneTapSignIn() {
  const { pathname, search } = window.location;
  const path = deLocalizeHref(pathname).replace(/\/$/, '');
  if (path === '/sign-in' || path === '/sign-up') {
    const params = new URLSearchParams(search);
    window.location.replace(
      authCallbackUrl(
        resolveAfterAuthUrl({
          callbackUrl: params.get('callbackUrl'),
          redirect: params.get('redirect'),
        })
      )
    );
    return;
  }

  // Reload the session even when the current URL ends in a fragment.
  window.location.reload();
}

export function GoogleOneTap() {
  const { data: session, isPending } = useSession();
  const { data: configs } = usePublicConfig();
  const handled = useRef(false);
  const signedIn = Boolean(session?.user);
  const enabled = configs?.google_one_tap_enabled === 'true';
  const clientId = configs?.google_client_id?.trim();

  useEffect(() => {
    if (isPending || handled.current) return;
    if (signedIn) {
      handled.current = true;
      return;
    }
    if (!enabled || !clientId) return;

    handled.current = true;
    void createOneTapAuthClient(clientId)
      .oneTap({
        fetchOptions: {
          onSuccess: ({ data }) => {
            if (data?.user) finishOneTapSignIn();
          },
        },
      })
      .catch(() => {
        // The regular Google sign-in button remains available if the prompt fails.
      });
  }, [clientId, enabled, isPending, signedIn]);

  return null;
}
