/**
 * In-app purchase through RevenueCat (ported from the web's
 * lib/native/iap.ts). Apple and Google require a digital subscription to be
 * sold through StoreKit / Play Billing inside the app (App Store 3.1.1), so
 * the app never shows a web checkout or an external purchase link. RevenueCat
 * reconciles the entitlement to the server by webhook (revenuecat-webhook.ts),
 * which sets user.plan like the web's checkout does.
 *
 * Inert until running natively AND VITE_REVENUECAT_IOS_KEY /
 * VITE_REVENUECAT_ANDROID_KEY is set at build time.
 */
import { platformName } from "./native";

const IOS_KEY = (import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined) ?? "";
const ANDROID_KEY = (import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined) ?? "";

function keyForPlatform(): string {
  const platform = platformName();
  if (platform === "ios") return IOS_KEY;
  if (platform === "android") return ANDROID_KEY;
  return "";
}

/** True only natively with a RevenueCat key configured. */
export function iapAvailable(): boolean {
  return keyForPlatform().length > 0;
}

let configuredFor: string | null = null;

async function loadPurchases(appUserId: string) {
  const apiKey = keyForPlatform();
  if (!apiKey) return null;
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  if (configuredFor === null) {
    // Our own user id, so the webhook maps the purchase back to the account.
    await Purchases.configure({ apiKey, appUserID: appUserId });
    configuredFor = appUserId;
  } else if (configuredFor !== appUserId) {
    await Purchases.logIn({ appUserID: appUserId });
    configuredFor = appUserId;
  }
  return Purchases;
}

export interface StoreOffer {
  /** The store's own localized price ("₩14,000/월" comes from the store, never from us). */
  priceString: string;
  title: string;
}

/** The current offering's first package — what "Subscribe" buys. */
export async function currentOffer(appUserId: string): Promise<StoreOffer | null> {
  try {
    const Purchases = await loadPurchases(appUserId);
    if (!Purchases) return null;
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages?.[0];
    if (!pkg) return null;
    return { priceString: pkg.product.priceString, title: pkg.product.title };
  } catch {
    return null;
  }
}

export type PurchaseOutcome = "purchased" | "cancelled" | "unavailable" | "error";

export async function startNativePurchase(appUserId: string): Promise<PurchaseOutcome> {
  try {
    const Purchases = await loadPurchases(appUserId);
    if (!Purchases) return "unavailable";
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages?.[0];
    if (!pkg) return "unavailable";
    await Purchases.purchasePackage({ aPackage: pkg });
    return "purchased";
  } catch (err) {
    if ((err as { userCancelled?: boolean })?.userCancelled) return "cancelled";
    return "error";
  }
}

/** Restore (Apple requires it to be reachable). True when any entitlement is active afterwards. */
export async function restoreNativePurchases(appUserId: string): Promise<boolean> {
  try {
    const Purchases = await loadPurchases(appUserId);
    if (!Purchases) return false;
    const { customerInfo } = await Purchases.restorePurchases();
    return Object.keys(customerInfo.entitlements.active).length > 0;
  } catch {
    return false;
  }
}

/** The store's own subscription page (Apple / Google), when the store gives one. */
export async function managementUrl(appUserId: string): Promise<string | null> {
  try {
    const Purchases = await loadPurchases(appUserId);
    if (!Purchases) return null;
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo.managementURL ?? null;
  } catch {
    return null;
  }
}
