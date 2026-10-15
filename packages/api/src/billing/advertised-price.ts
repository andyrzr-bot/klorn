/**
 * The advertised web price, as the API sees it.
 *
 * The source of truth is `packages/web/src/lib/pricing.ts` (`PRO_PRICE_WEB`).
 * The API cannot import it: `@klorn/contract` is type-only by design, and the
 * web package is not present in the API's deployment.
 *
 * So the value is restated here and `.github/scripts/check-price-consistency.mjs`
 * fails the build if the two ever differ. That is the point — a second copy
 * nobody checks is exactly the drift this whole area exists to prevent, while
 * a second copy CI compares is just a cache.
 *
 * Change `PRO_PRICE_WEB` and this together, or CI will say so.
 */
export const ADVERTISED_PRO_PRICE_WEB = "$29.99";
