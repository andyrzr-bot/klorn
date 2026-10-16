/**
 * Plans, pure part: the subscription length of the store package
 * (App Store 3.1.2 asks the purchase screen to show it, with the price per
 * period). RevenueCat gives a `packageType` (MONTHLY, ANNUAL, …) and the
 * product's ISO 8601 `subscriptionPeriod` (P1M, P1Y, …); the package type wins
 * when it names a length, the period covers custom packages.
 */
import type { MessageKey } from "../../i18n";

export type PeriodUnit = "week" | "month" | "year";

export interface SubscriptionLength {
  unit: PeriodUnit;
  count: number;
}

const BY_PACKAGE: Record<string, SubscriptionLength> = {
  WEEKLY: { unit: "week", count: 1 },
  MONTHLY: { unit: "month", count: 1 },
  TWO_MONTH: { unit: "month", count: 2 },
  THREE_MONTH: { unit: "month", count: 3 },
  SIX_MONTH: { unit: "month", count: 6 },
  ANNUAL: { unit: "year", count: 1 },
};

/** P1W / P1M / P3M / P1Y (P7D = a week, P12M = a year); null for anything else. */
export function parseIsoPeriod(iso: string | null | undefined): SubscriptionLength | null {
  const m = /^P(\d{1,2})([DWMY])$/.exec(iso ?? "");
  if (!m) return null;
  const n = Number(m[1]);
  if (!n) return null;
  switch (m[2]) {
    case "D":
      return n === 7 ? { unit: "week", count: 1 } : null;
    case "W":
      return { unit: "week", count: n };
    case "M":
      return n === 12 ? { unit: "year", count: 1 } : { unit: "month", count: n };
    default:
      return { unit: "year", count: n };
  }
}

export function subscriptionLengthOf(
  packageType: string | null | undefined,
  iso: string | null | undefined,
): SubscriptionLength | null {
  return (packageType ? BY_PACKAGE[packageType] : undefined) ?? parseIsoPeriod(iso);
}

/** The message keys + values for "1개월" and "월 ₩14,000". */
export function lengthText(length: SubscriptionLength): {
  key: MessageKey;
  values: Record<string, string | number>;
} {
  if (length.count === 1) return { key: `plans.period.${length.unit}`, values: {} };
  if (length.unit === "month")
    return { key: "plans.period.months", values: { count: length.count } };
  if (length.unit === "week") return { key: "plans.period.weeks", values: { count: length.count } };
  return { key: "plans.period.years", values: { count: length.count } };
}

export function pricePerText(
  length: SubscriptionLength,
  price: string,
): { key: MessageKey; values: Record<string, string | number> } {
  if (length.count === 1) return { key: `plans.pricePer.${length.unit}`, values: { price } };
  if (length.unit === "month")
    return { key: "plans.pricePer.months", values: { price, count: length.count } };
  if (length.unit === "week")
    return { key: "plans.pricePer.weeks", values: { price, count: length.count } };
  return { key: "plans.pricePer.years", values: { price, count: length.count } };
}
