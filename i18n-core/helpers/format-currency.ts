// Donor: nessuno (ricostruito su Intl.NumberFormat — pattern canonical agency)
// Brick: telegram-i18n-core v0.1.0 (le-GO C-UI)
//
// Formattazione importi monetari per locale + ISO 4217.
//
// Soft: in caso di Intl error (currency code invalido, runtime senza ICU)
// ritorna fallback "{amount} {currency}" senza throw.

import { DEFAULT_LOCALE } from "../types.ts";
import type { FormatCurrencyOptions, Locale } from "../types.ts";

/**
 * Formatta `amount` come stringa monetaria localizzata.
 *
 * Esempi:
 *   formatCurrency(1234.5, { currency: "EUR", locale: "it" })   → "1.234,50 €"
 *   formatCurrency(1234.5, { currency: "EUR", locale: "en" })   → "€1,234.50"
 *   formatCurrency(1234.5, { currency: "USD", locale: "de" })   → "1.234,50 $"
 *
 * `fraction_digits` default 2. Per importi interi (es. visualizzazione "10€"
 * compatta) il consumer può passare 0.
 */
export function formatCurrency(
  amount: number,
  opts: FormatCurrencyOptions = {},
): string {
  const locale = (opts.locale ?? DEFAULT_LOCALE) as Locale | string;
  const currency = opts.currency ?? "EUR";
  const fraction = opts.fraction_digits ?? 2;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    }).format(amount);
  } catch (e) {
    console.warn({
      fn: "i18n.formatCurrency",
      error: (e as Error)?.message ?? String(e),
      amount,
      currency,
      locale,
    });
    return `${amount.toFixed(fraction)} ${currency}`;
  }
}
