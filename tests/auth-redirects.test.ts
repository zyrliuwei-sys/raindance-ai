import assert from 'node:assert/strict';
import { test } from 'node:test';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { AFTER_AUTH_HOME, authCallbackUrl } from '../src/lib/redirect';
import { getLocale, overwriteGetLocale } from '../src/paraglide/runtime.js';

test('Google OAuth accepts the localized return URL with its fragment', async (t) => {
  const origin = 'https://example.test';
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: new URL(`${origin}/zh/sign-in`) },
  });
  const originalGetLocale = getLocale;
  overwriteGetLocale(() => 'zh');
  t.after(() => {
    Reflect.deleteProperty(globalThis, 'window');
    overwriteGetLocale(originalGetLocale);
  });

  const callbackURL = authCallbackUrl(AFTER_AUTH_HOME);
  assert.equal(callbackURL, `${origin}/zh#create`);
  assert.equal(
    authCallbackUrl('/pricing?name=a%26b#plans'),
    `${origin}/zh/pricing?name=a%26b#plans`
  );
  assert.equal(authCallbackUrl('//other.example.test/'), callbackURL);

  const auth = betterAuth({
    baseURL: origin,
    secret: 'isolated-test-secret-f9e6c8d13f235159',
    database: memoryAdapter({ verification: [] }),
    socialProviders: {
      google: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      },
    },
  });
  const response = await auth.handler(
    new Request(`${origin}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ provider: 'google', callbackURL }),
    })
  );

  assert.equal(response.status, 200);
  const authorizationURL = new URL((await response.json()).url);
  assert.equal(authorizationURL.origin, 'https://accounts.google.com');
  assert.equal(
    authorizationURL.searchParams.get('redirect_uri'),
    `${origin}/api/auth/callback/google`
  );
});
