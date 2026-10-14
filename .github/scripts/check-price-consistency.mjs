#!/usr/bin/env node
/**
 * The advertised price must be one number everywhere, and the native price
 * must never undercut the web one.
 *
 * Two failures this exists for, both of which shipped:
 *
 *   2026-08-12 — the app advertised $7.99 while Paddle, the Terms page and
 *   both landings said $8.99. Customers were quoted a price nobody charged.
 *   lib/pricing.ts was created to fix it, but nothing stopped the static
 *   pages under website/ from drifting away from it again — they import
 *   nothing.
 *
 *   2026-10-14 — the web price went $8.99 → $30 and PRO_PRICE_NATIVE stayed
 *   $9.99, leaving the native paywall quoting a third of the web price. Not a
 *   discount; two different public prices for one product.
 *
 * So: lib/pricing.ts is the source of truth, every static page is compared
 * against it, and native >= web is asserted. de/fr write prices in European
 * format (30 $, not $30) and a naive /\$[\d.]+/ sweep silently skips them —
 * both forms are matched here on purpose.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PRICING_TS = "packages/web/src/lib/pricing.ts";

/** Pull a `export const NAME = "$12.34";` literal out of pricing.ts. */
function readConst(source, name) {
  const match = source.match(
    new RegExp(`export const ${name}\\s*=\\s*"([^"]+)"`),
  );
  if (!match) throw new Error(`${PRICING_TS}: ${name} not found`);
  return match[1];
}

/** Dollars in "$30", "$34.99" or "30 $" — the de/fr form included. */
function amount(price) {
  const parsed = Number(price.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Unparseable price string: ${price}`);
  }
  return parsed;
}

const source = readFileSync(PRICING_TS, "utf8");
const web = readConst(source, "PRO_PRICE_WEB");
const native = readConst(source, "PRO_PRICE_NATIVE");

const problems = [];

if (amount(native) < amount(web)) {
  problems.push(
    `${PRICING_TS}: PRO_PRICE_NATIVE (${native}) is below PRO_PRICE_WEB (${web}). ` +
      `The store takes a cut, so native is never the cheaper surface — and two ` +
      `public prices for one product is the 2026-08-12 bug wearing a new hat.`,
  );
}

// Every price-like string on a page we publish, in both notations. Tolerates
// "$30/mo", "30 $ im Monat", "<strong>$30</strong>/month".
const PRICE = /(?:\$\s?(\d+(?:[.,]\d{2})?)|(\d+(?:[.,]\d{2})?)\s?\$)/g;

const webAmount = amount(web);

/** Every index.html under website/, without pulling in a glob dependency. */
function pagesUnder(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...pagesUnder(path));
    else if (entry.name === "index.html") found.push(path);
  }
  return found;
}

const pages = pagesUnder("website").sort();
if (pages.length === 0) problems.push("no website/**/index.html found");

for (const page of pages) {
  const html = readFileSync(page, "utf8");
  // Only the strings that claim to be OUR price: a Klorn Pro price card, the
  // pricing-table "us" column, or a link into /pricing/. Competitor tables sit
  // outside these and are left alone.
  const ours = [
    ...html.matchAll(/<div class="amt">([^<]*)</g),
    ...html.matchAll(/<td class="us">(?:(?!<\/td>).)*?<\/td>/gs),
    ...html.matchAll(/<a href="\/pricing\/">([^<]*)</g),
  ].map((m) => m[0]);

  for (const fragment of ours) {
    for (const hit of fragment.matchAll(PRICE)) {
      const raw = (hit[1] ?? hit[2]).replace(",", ".");
      if (raw === "0") continue; // the free tier card
      if (Number(raw) !== webAmount) {
        problems.push(
          `${page}: quotes $${raw} as Klorn's price, but ${PRICING_TS} says ${web}`,
        );
      }
    }
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(`::error::${p}`);
  process.exit(1);
}

console.log(
  `price consistency: ${web} web / ${native} native, ` +
    `and ${pages.length} published page(s) agree with ${PRICING_TS}.`,
);
