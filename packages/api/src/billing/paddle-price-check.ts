/**
 * Does Paddle actually charge what the site advertises?
 *
 * Nothing else in this repo can answer that. `packages/web/src/lib/pricing.ts`
 * makes our own surfaces agree with each other, and
 * `.github/scripts/check-price-consistency.mjs` makes the static pages agree
 * with that constant — but the number that bills a real person lives on a
 * Paddle price object, outside the repo, editable from a dashboard.
 *
 * That gap is where both incidents happened:
 *
 *   2026-08-12 — the app advertised $7.99 while Paddle charged $8.99.
 *   2026-10-15 — the Paddle price was edited to $29.99 while every page still
 *   said $8.99. Customers were billed MORE than they were quoted, and we
 *   found out because the founder mentioned it.
 *
 * So this runs at boot, fetches the configured price, and says so when the two
 * disagree. It warns and returns — it never throws and never blocks startup.
 * A billing provider being briefly unreachable must not take the API down, and
 * the precedent here is the judge model gate: degrade, not amputate.
 */

import { captureError } from "../sentry.js";

/** Minor units per major unit. Paddle returns amounts as integer cents. */
const CENTS_PER_DOLLAR = 100;

/** Every price surface promises this; the trial lives on the price object. */
const EXPECTED_TRIAL_DAYS = 7;

/**
 * Dollars in an advertised price string.
 *
 * Accepts both "$30" and the German/French "30 $", because those two landings
 * write prices with a trailing sign and a decimal comma. A dollar-first parser
 * skips them in silence — which is how de and fr came to disagree with their
 * own price card before 2026-10-14.
 */
export function parseAdvertisedAmount(price: string): number {
  const digits = String(price ?? "")
    .replace(/[^0-9.,]/g, "")
    .replace(",", ".");
  const parsed = Number(digits);
  if (!digits || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Unreadable advertised price: ${JSON.stringify(price)}`);
  }
  return parsed;
}

export interface PriceComparison {
  ok: boolean;
  /** Every disagreement found, not just the first. */
  problems: string[];
}

/**
 * Compare a Paddle price object against the advertised string.
 *
 * Pure, so the interesting cases are testable without a network or a key. The
 * `price` argument is deliberately `unknown`: it comes from a third party, and
 * a response shape we do not recognise must read as "cannot confirm", never as
 * "agrees".
 */
export function comparePaddlePrice(opts: { advertised: string; price: unknown }): PriceComparison {
  const problems: string[] = [];

  let advertisedAmount: number;
  try {
    advertisedAmount = parseAdvertisedAmount(opts.advertised);
  } catch (err) {
    return { ok: false, problems: [(err as Error).message] };
  }

  if (typeof opts.price !== "object" || opts.price === null) {
    return {
      ok: false,
      problems: [
        `Paddle price response was ${typeof opts.price}, not an object — cannot confirm what is charged`,
      ],
    };
  }

  const price = opts.price as {
    status?: unknown;
    unit_price?: { amount?: unknown; currency_code?: unknown };
    trial_period?: { interval?: unknown; frequency?: unknown } | null;
  };

  // --- what it charges -----------------------------------------------------
  const rawAmount = price.unit_price?.amount;
  if (typeof rawAmount !== "string" && typeof rawAmount !== "number") {
    problems.push("Paddle price has no unit_price.amount — cannot confirm what is charged");
  } else {
    const cents = Number(rawAmount);
    if (!Number.isFinite(cents)) {
      problems.push(`Paddle unit_price.amount is not a number: ${String(rawAmount)}`);
    } else {
      const charged = cents / CENTS_PER_DOLLAR;
      if (charged !== advertisedAmount) {
        const direction = charged > advertisedAmount ? "charges more than" : "charges less than";
        problems.push(
          `Paddle ${direction} the site advertises: billing $${charged} ` +
            `against an advertised ${opts.advertised}.` +
            (charged > advertisedAmount
              ? " Customers are being billed above the price they were quoted."
              : ""),
        );
      }
    }
  }

  // --- in what currency ----------------------------------------------------
  const currency = price.unit_price?.currency_code;
  if (currency !== "USD") {
    problems.push(`Paddle price is in ${String(currency)}, but every surface quotes US dollars`);
  }

  // --- with what trial -----------------------------------------------------
  // createPaddleCheckout sends only price_id and quantity, so a price without
  // a trial bills immediately while the pages promise seven free days.
  const trial = price.trial_period;
  if (!trial) {
    problems.push(
      `Paddle price has no trial_period, but every price surface promises a ` +
        `${EXPECTED_TRIAL_DAYS}-day trial — the first charge lands immediately`,
    );
  } else if (trial.interval !== "day" || Number(trial.frequency) !== EXPECTED_TRIAL_DAYS) {
    problems.push(
      `Paddle trial is ${String(trial.frequency)} ${String(trial.interval)}(s), ` +
        `but the pages promise ${EXPECTED_TRIAL_DAYS} days`,
    );
  }

  // --- and is it even live -------------------------------------------------
  if (price.status !== "active") {
    problems.push(
      `Paddle price status is "${String(price.status)}" — an archived or ` +
        `inactive price is still wired to PADDLE_PRO_PRICE_ID`,
    );
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Fetch the configured price and report any disagreement. Never throws.
 *
 * Returns the comparison when one was made, or null when there was nothing to
 * check (Paddle not configured) or the fetch failed — the caller treats both
 * as "no answer", which is different from "they agree".
 */
export async function checkPaddlePriceMatchesAdvertised(opts: {
  advertised: string;
  fetchImpl?: typeof fetch;
}): Promise<PriceComparison | null> {
  const apiKey = process.env.PADDLE_API_KEY;
  const priceId = process.env.PADDLE_PRO_PRICE_ID;
  if (!apiKey || !priceId) return null;

  const base =
    process.env.PADDLE_ENV === "sandbox"
      ? "https://sandbox-api.paddle.com"
      : "https://api.paddle.com";
  const doFetch = opts.fetchImpl ?? fetch;

  let body: unknown;
  try {
    const res = await doFetch(`${base}/prices/${encodeURIComponent(priceId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      // Never echo the key; Paddle's body carries request ids worth having.
      const detail = await res.text().catch(() => "");
      console.warn(
        `[PADDLE] could not read price ${priceId}: ${res.status} ${detail.slice(0, 200)}`,
      );
      return null;
    }
    body = await res.json();
  } catch (err) {
    console.warn(`[PADDLE] price check could not reach Paddle: ${(err as Error).message}`);
    return null;
  }

  const price = (body as { data?: unknown })?.data;
  const result = comparePaddlePrice({ advertised: opts.advertised, price });

  if (!result.ok) {
    const summary = `[PADDLE] advertised price and Paddle price disagree: ${result.problems.join(" | ")}`;
    console.error(summary);
    captureError(new Error(summary), {
      tags: { scope: "billing.paddle.price_mismatch" },
      extra: { priceId, advertised: opts.advertised, problems: result.problems },
    });
  } else {
    console.log(`[PADDLE] price ${priceId} matches the advertised ${opts.advertised}.`);
  }

  return result;
}
