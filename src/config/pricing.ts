/**
 * Authoritative pricing catalog.
 *
 * The checkout API uses this as the SOURCE OF TRUTH for price/credits/duration.
 * Any price, credits, or plan info sent by the client is IGNORED — only the
 * product_id is honored, and everything else is looked up here.
 *
 * To change pricing, edit this file and redeploy. Admin UI cannot alter prices.
 */

import { PaymentInterval, PaymentType } from '@/core/payment/types';

/**
 * Public pricing switch. While false, the /pricing page redirects home and
 * every link to it (site header/footer, settings billing/credits) is hidden.
 * Checkout itself is untouched, so flip this back to true to relaunch.
 */
export const PRICING_ENABLED = true;

export type PricingPlanInfo = {
  name: string;
  interval: PaymentInterval;
  intervalCount: number;
};

export type PricingProduct = {
  productId: string;
  productName: string;
  planName: string;
  description: string;
  type: PaymentType;
  priceInCents: number;
  currency: string;
  credits: number;
  creditsValidDays?: number;
  plan?: PricingPlanInfo;
};

/**
 * Raindance AI catalog: four one-time credit packs, no subscriptions.
 *
 * 1 credit = 1 Evolink credit, and videos are charged at 7× their Evolink
 * cost (see ./everygen-pricing.ts). Pricing floor: no pack may sell a credit
 * below Evolink's $0.0147, or the 7× margin shrinks — check
 * priceInCents / credits ≥ 1.47 before adding or changing a product.
 * Keys MUST match what the pricing UI sends as product_id.
 */
export const USD_CENTS_PER_CREDIT_FLOOR = 1.47;

/**
 * First-order bonus (credits for one 5 s 480p video), granted once per user
 * on their first paid order of the Standard pack ($19.99) or larger — a
 * reason to pick the bigger pack, not a free trial.
 */
export const FIRST_ORDER_BONUS_MIN_CENTS = 1999;

export function qualifiesForFirstOrderBonus(order: { priceInCents: number }) {
  return order.priceInCents >= FIRST_ORDER_BONUS_MIN_CENTS;
}

function pack(
  productId: string,
  productName: string,
  priceInCents: number,
  credits: number
): PricingProduct {
  return {
    productId,
    productName,
    planName: productName,
    description: productName,
    type: PaymentType.ONE_TIME,
    priceInCents,
    currency: 'usd',
    credits,
  };
}

export const pricingCatalog: Record<string, PricingProduct> = {
  pack_starter: pack('pack_starter', 'Starter Pack', 999, 675),
  pack_standard: pack('pack_standard', 'Standard Pack', 1999, 1350),
  pack_pro: pack('pack_pro', 'Pro Pack', 3999, 2720),
  pack_studio: pack('pack_studio', 'Studio Pack', 7999, 5440),
};

export function getPricingProduct(productId: string): PricingProduct | null {
  if (!productId) return null;
  return pricingCatalog[productId] ?? null;
}

export function listPricingProducts(): PricingProduct[] {
  return Object.values(pricingCatalog);
}
