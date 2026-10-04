/** Five-second, silent Everygen clip. Admin setting everygen_credits overrides this. */
export const EVERYGEN_CREDITS = 400;

export function resolveEverygenCredits(configs: Record<string, string>) {
  const value = Number(configs.everygen_credits);
  return Number.isFinite(value) && value > 0 && value <= 100000
    ? Math.ceil(value)
    : EVERYGEN_CREDITS;
}
