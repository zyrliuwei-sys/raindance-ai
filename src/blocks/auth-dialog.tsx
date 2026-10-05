import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';

import { signIn, signUp } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { currentPathWithQuery } from '@/lib/redirect';
import { track } from '@/lib/track';
import { m } from '@/paraglide/messages.js';
import { usePublicConfig } from '@/hooks/use-public-config';
import { TextField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldSeparator } from '@/components/ui/field';

const schema = z.object({
  email: z.string().email(m['common.sign.email_placeholder']()),
  password: z.string().min(8),
});

/**
 * Sign up / sign in without leaving the page, so a visitor's free poster stays
 * on screen. Setups that need extra steps (email verification, invite codes)
 * hand off to the full /sign-up page instead.
 */
export default function AuthDialog({
  open,
  onOpenChange,
  onSignedIn,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignedIn: () => void;
  description?: string;
}) {
  const [mode, setMode] = useState<'sign-up' | 'sign-in'>('sign-up');
  const [error, setError] = useState('');
  const { data: configs = {} } = usePublicConfig();
  const signUpMode = mode === 'sign-up';
  const callbackUrl = currentPathWithQuery('/');
  const needsFullPage =
    signUpMode &&
    (configs.email_verification_enabled === 'true' ||
      configs.invite_code_required === 'true');
  const emailEnabled = configs.email_auth_enabled !== 'false';
  const googleEnabled = configs.google_auth_enabled === 'true';

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      setError('');
      const result: any = signUpMode
        ? await signUp.email({
            name: value.email.split('@')[0],
            email: value.email,
            password: value.password,
          })
        : await signIn.email({ email: value.email, password: value.password });
      if (result?.error) {
        setError(result.error.message || 'Sign in failed');
        return;
      }
      track(signUpMode ? 'sign_up' : 'login', {
        method: 'email',
        from: 'studio',
      });
      onOpenChange(false);
      onSignedIn();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {signUpMode
              ? m['common.sign.sign_up_title']()
              : m['common.sign.sign_in_title']()}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <FieldGroup>
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
              {error}
            </div>
          )}
          {googleEnabled && (
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                track('sign_up_social_click', {
                  method: 'google',
                  from: 'studio',
                });
                void signIn.social({
                  provider: 'google',
                  callbackURL: callbackUrl,
                });
              }}
            >
              {m['common.sign.google_sign_in']()}
            </Button>
          )}
          {googleEnabled && emailEnabled && (
            <FieldSeparator className="*:data-[slot=field-separator-content]:bg-popover">
              {m['common.sign.or']()}
            </FieldSeparator>
          )}
          {emailEnabled && needsFullPage ? (
            <Link
              href={`/sign-up?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-center text-sm font-medium"
            >
              {m['common.sign.sign_up_title']()}
            </Link>
          ) : (
            emailEnabled && (
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit();
                }}
              >
                <form.Field name="email">
                  {(field) => (
                    <TextField
                      field={field}
                      label={m['common.sign.email_title']()}
                      type="email"
                      required
                      placeholder={m['common.sign.email_placeholder']()}
                    />
                  )}
                </form.Field>
                <form.Field name="password">
                  {(field) => (
                    <TextField
                      field={field}
                      label={m['common.sign.password_title']()}
                      type="password"
                      required
                      placeholder={m['common.sign.password_placeholder']()}
                    />
                  )}
                </form.Field>
                <form.Subscribe selector={(s) => s.isSubmitting}>
                  {(isSubmitting) => (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting
                        ? '...'
                        : signUpMode
                          ? m['common.sign.sign_up_title']()
                          : m['common.sign.sign_in_title']()}
                    </Button>
                  )}
                </form.Subscribe>
              </form>
            )
          )}
          <Field>
            <p className="text-muted-foreground text-center text-sm">
              {signUpMode
                ? m['common.sign.already_have_account']()
                : m['common.sign.no_account']()}{' '}
              <button
                type="button"
                className="text-foreground underline underline-offset-4"
                onClick={() => {
                  setError('');
                  setMode(signUpMode ? 'sign-in' : 'sign-up');
                }}
              >
                {signUpMode
                  ? m['common.sign.sign_in_title']()
                  : m['common.sign.sign_up_title']()}
              </button>
            </p>
          </Field>
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
}
