// Donor: ~/Sviluppo/erp/gomyreference/src/lib/brand-config.ts (toHslVar)
// Donor: ~/Sviluppo/erp/gocotech-website/src/le-go/brand-white-label/lib/brand-config.ts
// Brick: telegram-white-label-runtime v0.1.0 (le-GO C-UI)

import type { TelegramBrandConfig } from "../types.ts";

/**
 * Converte hex (#1A4D5C) o HSL string ("192 71% 21%") in formato CSS var
 * Tailwind. Se input non valido, ritorna `null`.
 *
 * Replicato dal donor per indipendenza dal brick React `brand-white-label`
 * (questo brick può essere usato anche da edge fn Deno, dove la UI React
 * non è disponibile — generatore CSS qui è per la PWA companion del bot).
 */
export function toHslVar(color: string | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!trimmed.startsWith('#')) return trimmed;
  const hex = trimmed.slice(1);
  if (hex.length !== 6 && hex.length !== 3) return null;
  const full = hex.length === 3
    ? hex.split('').map((c) => c + c).join('')
    : hex;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  const H = Math.round(h * 360);
  const S = Math.round(s * 100);
  const L = Math.round(l * 100);
  return `${H} ${S}% ${L}%`;
}

/**
 * Genera CSS vars per la PWA companion del bot (theming Tailwind).
 *
 * Output esempio:
 * ```css
 * :root {
 *   --primary: 192 71% 21%;
 *   --accent:  19 84% 49%;
 * }
 * ```
 *
 * Ritorna stringa vuota se brand non ha colori.
 */
export function generateCssVars(brand: TelegramBrandConfig): string {
  const lines: string[] = [];
  const primary = toHslVar(brand.primary_color);
  const accent = toHslVar(brand.accent_color);

  if (primary) lines.push(`  --primary: ${primary};`);
  if (accent) lines.push(`  --accent:  ${accent};`);

  if (lines.length === 0) return '';
  return `:root {\n${lines.join('\n')}\n}\n`;
}
