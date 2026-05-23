// Donor: nessuno (ricostruito su Intl.DateTimeFormat + Intl.RelativeTimeFormat)
// Brick: telegram-i18n-core v0.1.0 (le-GO C-UI)
//
// Formattazione date localizzate + relative time ("3 giorni fa").
//
// Soft: nessun throw, fallback ISO se Intl fallisce.

import { DEFAULT_LOCALE } from "../types.ts";
import type { FormatDateOptions, Locale } from "../types.ts";

/**
 * Formatta una Date (o ISO string, o epoch ms) come stringa localizzata.
 *
 * Esempi (locale it):
 *   formatDate(now, {style: "short"})    → "23/05/26"
 *   formatDate(now, {style: "medium"})   → "23 mag 2026"
 *   formatDate(now, {style: "long"})     → "23 maggio 2026"
 *   formatDate(now, {style: "iso"})      → "2026-05-23"
 *   formatDate(now, {style: "relative"}) → "oggi" / "3 giorni fa" / "ieri"
 */
export function formatDate(
  input: Date | string | number,
  opts: FormatDateOptions = {},
): string {
  const locale = (opts.locale ?? DEFAULT_LOCALE) as Locale | string;
  const style = opts.style ?? "medium";
  const include_time = opts.include_time ?? false;

  const date = toDate(input);
  if (!date) {
    console.warn({ fn: "i18n.formatDate", invalid_input: String(input) });
    return String(input);
  }

  if (style === "iso") {
    const iso = date.toISOString();
    return include_time ? iso : iso.slice(0, 10);
  }

  if (style === "relative") {
    return formatRelative(date, locale);
  }

  try {
    const opts: Intl.DateTimeFormatOptions = {
      year: style === "short" ? "2-digit" : "numeric",
      month: style === "short" ? "2-digit" : style === "medium" ? "short" : "long",
      day: "2-digit",
    };
    if (include_time) {
      opts.hour = "2-digit";
      opts.minute = "2-digit";
    }
    return new Intl.DateTimeFormat(locale, opts).format(date);
  } catch (e) {
    console.warn({
      fn: "i18n.formatDate",
      error: (e as Error)?.message ?? String(e),
      locale,
    });
    return date.toISOString().slice(0, include_time ? 16 : 10).replace("T", " ");
  }
}

function toDate(input: Date | string | number): Date | null {
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === "number") {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === "string") {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Relative time ("3 giorni fa", "tra 2 ore"). Usa Intl.RelativeTimeFormat se
 * disponibile, altrimenti fallback inglese hard-coded.
 */
function formatRelative(date: Date, locale: Locale | string): string {
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const absMs = Math.abs(diffMs);

  // Soglia auto-selezione unit.
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;
  if (absMs < minute) {
    value = Math.round(diffMs / 1000);
    unit = "second";
  } else if (absMs < hour) {
    value = Math.round(diffMs / minute);
    unit = "minute";
  } else if (absMs < day) {
    value = Math.round(diffMs / hour);
    unit = "hour";
  } else if (absMs < week) {
    value = Math.round(diffMs / day);
    unit = "day";
  } else if (absMs < month) {
    value = Math.round(diffMs / week);
    unit = "week";
  } else if (absMs < year) {
    value = Math.round(diffMs / month);
    unit = "month";
  } else {
    value = Math.round(diffMs / year);
    unit = "year";
  }

  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit);
  } catch {
    // Fallback rudimentale.
    const prefix = value < 0 ? "" : "in ";
    const suffix = value < 0 ? " ago" : "";
    return `${prefix}${Math.abs(value)} ${unit}${Math.abs(value) === 1 ? "" : "s"}${suffix}`;
  }
}
