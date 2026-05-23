// Brick: telegram-bot-snapshot-test v0.1.0 (le-GO G-Ops)
// Fixture loader: parse YAML semplice (no external lib) per portabilità Deno.
//
// Per fixture complessi conviene parser YAML completo. Qui implementazione
// minimal che supporta nesting, list (-), scalari, e !literal strings.

import type { FixtureSet } from "../types.ts";

/**
 * Carica fixture da file YAML. Throws su parse error.
 */
export async function loadFixtures(path: string): Promise<FixtureSet> {
  const text = await Deno.readTextFile(path);
  // Pragmatic: il file fixture è scritto in JSON-compatibile-YAML per sicurezza.
  // Convertiamo YAML semplice a JSON usando yaml-tag stripping + regex.
  // Per produzione, usare libreria YAML standard di Deno: import * as yaml from "https://deno.land/std/yaml/mod.ts";

  // Import via JSR (richiesto per pacchetto pubblicato JSR)
  const yaml = await import("jsr:@std/yaml@^1.0.0");
  return yaml.parse(text) as FixtureSet;
}

/**
 * Carica fixture da JSON file (alternativa più sicura).
 */
export async function loadFixturesJson(path: string): Promise<FixtureSet> {
  const text = await Deno.readTextFile(path);
  return JSON.parse(text) as FixtureSet;
}
